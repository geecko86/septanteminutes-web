#!/usr/bin/env node
// scripts/dub/cascade.mjs
//
// LOCAL FR->EN dubbing CASCADE for septanteminutes.be ($0 translation).
//
//   node scripts/dub/cascade.mjs 38                          cascade-dub episode 38 (full)
//   node scripts/dub/cascade.mjs 38 --clip 2275:2346         only the [2275,2346]s clip (PoC)
//   node scripts/dub/cascade.mjs 38 --clip 2275:2346 --fit   time-stretch each clip to its slot
//   node scripts/dub/cascade.mjs 38 --engine chatterbox      synth the SAME cached plan with another engine
//   node scripts/dub/cascade.mjs 38 --units turn             merge same-speaker utterances into <=30s turns
//   node scripts/dub/cascade.mjs 38 --ref-mode source        clone from each unit's OWN source audio
//   node scripts/dub/cascade.mjs 38 --plan-only              compute + cache the plan, no synthesis
//   node scripts/dub/cascade.mjs 38 --engine xtts --force    recompute plan AND re-synthesise
//
// Unlike the speech-to-speech models (dub.mjs / dub-elevenlabs.mjs), this is a
// CASCADE, now split into two stages so a single PLAN can feed a multi-engine
// A/B without re-translating or re-picking references:
//
//   PLAN  (engine-agnostic, cached): resolve episode -> ensure audio cached ->
//     load raw diarized ASR -> mergePhantomSpeakers + buildSegments restricted
//     to the clip window -> translate utterances FR->EN preserving disfluencies
//     (Claude, $0 on the subscription) -> assemble synth UNITS (--units: one per
//     utterance, or same-speaker utterances merged into <=30s turns) -> pick
//     references (--ref-mode: one FLUENT clean clip per SPEAKER, or each unit's
//     OWN source-audio span). Translation always runs per ORIGINAL utterance
//     before any turn merge, so quality is independent of --units. Written once
//     to .dub-cache/{num}/plan{suffix}.{units}.{refmode}.json; recomputed only
//     with --force (distinct option combos cache to distinct files).
//
//   SYNTH (per --engine): from the cached plan, write a per-engine synth
//     manifest, invoke the engine adapter ONCE in batch (model loads once), then
//     reassemble on the original timeline (gaps + optional --fit) to
//     .dub-cache/{num}/cascade-en.{engine}{suffix}.{units}.{refmode}.mp3. Engine
//     intermediates are namespaced under .dub-cache/{num}/{engine}{suffix}.{units}.{refmode}/
//     so engines AND option variants never collide. Source-mode references are
//     engine-agnostic and live at the episode root (.dub-cache/{num}/refsrc-{id}.wav).
//
// This script reads only the gitignored caches; it never re-charges ElevenLabs
// or re-downloads audio that is already present. Translation runs on the Claude
// subscription via `claude -p` (cost $0 there; an estimate is printed when the
// SDK fallback is used).

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT_DIR, ASR_CACHE_DIR, TRANSCRIPTS_DIR, resolveLanguage } from '../transcribe/config.mjs';
import { loadEpisodes, resolveSelection } from '../transcribe/episodes.mjs';
import { downloadAudio } from '../transcribe/download.mjs';
import { buildSegments, mergePhantomSpeakers } from '../transcribe/segments.mjs';
import { runStructuredPrompt, detectBackend, QuotaExhaustedError } from '../transcribe/llm.mjs';
import { buildTranslationPrompt, TRANSLATION_SCHEMA } from './translate.mjs';

/** Gitignored cache for dubbing artifacts: .dub-cache/{num}/... */
const DUB_CACHE_DIR = path.join(ROOT_DIR, '.dub-cache');

/** Engine -> Python adapter. tts_chatterbox.py / tts_f5.py implement the same contract. */
const ENGINE_ADAPTERS = {
  xtts: 'tts/tts_xtts.py',
  chatterbox: 'tts/tts_chatterbox.py',
  f5: 'tts/tts_f5.py',
  cosyvoice: 'tts/tts_cosyvoice.py',
};

/** The venv each engine expects its python in (scripts/dub/.venv-<engine>). */
const ENGINE_VENVS = {
  xtts: '.venv-xtts',
  chatterbox: '.venv-chatterbox',
  f5: '.venv-f5',
  cosyvoice: '.venv-cosyvoice',
};

/** Utterances per translation batch (~80 keeps output well under the cap). */
const TRANSLATE_BATCH = 80;

/** Reference clip selection: aim for ~8s of clean speech, accept 6-10s. */
const REF_TARGET_SEC = 8;
const REF_MIN_SEC = 6;
const REF_MAX_SEC = 10;

/**
 * French filler/hesitation tokens penalised by the reference fluency scorer:
 * a reference full of these clones a hesitant voice and worsens XTTS rambling.
 */
const FILLER_TOKENS = new Set(['euh', 'bah', 'ben', 'hein', 'heu', 'hum', 'heuh', 'hmm', 'mmh', 'bah,', 'euh,']);

/** Inter-utterance silence inserted on reassembly is clamped to this range. */
const MAX_GAP_SEC = 1.0;

/**
 * --units turn: consecutive same-speaker utterances are merged into one synth
 * unit as long as the merged span stays within this many seconds (and no other
 * speaker speaks in between). ~30s matches segments.mjs's force-break ceiling.
 */
const TURN_MAX_SEC = 30;

/** --fit time-stretch is only applied within this atempo range (else skipped). */
const FIT_MIN_TEMPO = 0.85;
const FIT_MAX_TEMPO = 1.15;

/**
 * EMOTION-ADAPTIVE expressiveness mapping. Each synth-manifest item gets a
 * per-unit `exaggeration` and `cfg_weight` derived from the unit's intensity
 * (0..1), so calm lines are voiced flat and heated ones dramatically — instead
 * of one global exaggeration for the whole episode. These are engine-AGNOSTIC
 * hints in the manifest; today only the chatterbox adapter reads them (and only
 * if its installed generate() accepts those knobs), falling back to its
 * env/global default otherwise.
 *
 *   exaggeration = EXAG_BASE + EXAG_SPAN * intensity
 *     intensity 0.0 -> 0.30,  0.1 -> 0.35 (calm),  0.5 -> 0.55,
 *     intensity 0.9 -> 0.75 (heated),  1.0 -> 0.80
 *   cfg_weight   = CFG_BASE - CFG_SPAN * intensity   (more expressive => lower cfg)
 *     intensity 0.0 -> 0.50,  0.5 -> 0.40,  1.0 -> 0.30
 */
const EXAG_BASE = 0.3;
const EXAG_SPAN = 0.5;
const CFG_BASE = 0.5;
const CFG_SPAN = 0.2;

/** intensity (0..1) -> per-item chatterbox exaggeration, rounded to 2 dp. */
function intensityToExaggeration(intensity) {
  return round2(EXAG_BASE + EXAG_SPAN * clamp(Number(intensity) || 0, 0, 1));
}

/** intensity (0..1) -> per-item chatterbox cfg_weight, rounded to 2 dp. */
function intensityToCfgWeight(intensity) {
  return round2(CFG_BASE - CFG_SPAN * clamp(Number(intensity) || 0, 0, 1));
}

const HELP = `Usage: node scripts/dub/cascade.mjs <episodeNum> [options]

Local FR->EN dubbing cascade, split into a cached engine-agnostic PLAN and a
per-engine SYNTH so one plan can feed a multi-engine A/B:
  PLAN  segment cached ASR -> translate FR->EN (Claude, disfluencies preserved,
        $0 on the subscription) -> pick one clean reference clip per speaker.
  SYNTH per-speaker zero-shot voice-clone TTS (batch) -> reassemble a timeline.

Options:
  --clip <a>:<b>   process only the [a,b] second range of the episode (PoC runs);
                   the plan + output filenames note the range
  --engine <name>  TTS engine for SYNTH (default xtts; one of: ${Object.keys(ENGINE_ADAPTERS).join(', ')})
  --units <mode>   synthesis granularity (default utterance):
                     utterance  one TTS clip per ASR utterance (original behavior)
                     turn       MERGE consecutive same-speaker utterances into one
                                unit (<= ${TURN_MAX_SEC}s, no other speaker between) so the
                                voice flows instead of sounding stringed-together.
                                Translation still runs PER utterance, then the
                                English is concatenated for the turn (quality unchanged).
  --ref-mode <m>   voice-clone reference per unit (default fixed):
                     fixed      one fluency-selected clean reference per speaker
                     source     each unit clones from its OWN source-audio span
                                (the real moment + delivery), ref_text = that span's
                                French. Reference wavs cached at .dub-cache/{num}/refsrc-{id}.wav.
  --fit            time-stretch each TTS clip toward its original slot duration
                   (ffmpeg atempo, clamped 0.85-1.15x; skipped outside that range)
  --plan-only      compute + cache the PLAN and stop (no engine, no synthesis)
  --force          recompute the cached PLAN (translation + references) AND
                   re-synthesise even if artifacts already exist
  -h, --help       show this help

Prereqs: run \`yarn transcribe <num>\` first so the source mp3 and diarized ASR
cache exist; set up the engine venv (see scripts/dub/tts/README.md); have
ffmpeg/ffprobe on PATH.`;

const log = (msg) => console.log(msg);

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      clip: { type: 'string' },
      engine: { type: 'string', default: 'xtts' },
      units: { type: 'string', default: 'utterance' },
      'ref-mode': { type: 'string', default: 'fixed' },
      fit: { type: 'boolean', default: false },
      'plan-only': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }
  if (positionals.length > 1) {
    throw new Error(`dub one episode at a time, got: ${positionals.join(', ')}`);
  }

  // --- Validate options ---------------------------------------------------

  const planOnly = values['plan-only'];
  const engine = values.engine.trim();
  const adapterRel = ENGINE_ADAPTERS[engine];
  if (!adapterRel) {
    throw new Error(
      `--engine must be one of ${Object.keys(ENGINE_ADAPTERS).join(', ')}, got "${engine}"`,
    );
  }

  const units = values.units.trim();
  if (units !== 'utterance' && units !== 'turn') {
    throw new Error(`--units must be "utterance" or "turn", got "${units}"`);
  }
  const refMode = values['ref-mode'].trim();
  if (refMode !== 'fixed' && refMode !== 'source') {
    throw new Error(`--ref-mode must be "fixed" or "source", got "${refMode}"`);
  }

  const clip = values.clip != null ? parseClip(values.clip) : null;

  ensureTool('ffmpeg');
  ensureTool('ffprobe');

  // The engine adapter + its venv python must exist before SYNTH (not for --plan-only).
  let adapterPath = null;
  let enginePython = null;
  if (!planOnly) {
    adapterPath = path.join(ROOT_DIR, 'scripts', 'dub', adapterRel);
    if (!fs.existsSync(adapterPath)) {
      throw new Error(`engine adapter missing at ${adapterPath}. See scripts/dub/tts/README.md.`);
    }
    enginePython = path.join(ROOT_DIR, 'scripts', 'dub', ENGINE_VENVS[engine], 'bin', 'python');
    if (!fs.existsSync(enginePython)) {
      throw new Error(
        `${engine} venv python not found at ${enginePython}.\n` +
          `Create it and install the engine's deps — see scripts/dub/tts/README.md.`,
      );
    }
  }

  // --- Resolve the episode (reuse the transcribe selection logic) ---------

  const [episode] = resolveSelection(loadEpisodes(), { nums: positionals });
  const { num } = episode;

  const episodeDir = path.join(DUB_CACHE_DIR, String(num));
  fs.mkdirSync(episodeDir, { recursive: true });

  // Clip range goes in every artifact name. The PLAN additionally varies by
  // --units (utterance vs turn) and --ref-mode (the source refs are baked into
  // the plan), so its filename also carries those — distinct variants must not
  // overwrite each other. e.g. plan.clip-2275-2346.turn.source.json
  const suffix = clip ? `.clip-${Math.round(clip.start)}-${Math.round(clip.end)}` : '';
  const planSuffix = `${suffix}.${units}.${refMode}`;

  // --- STAGE 1: PLAN (engine-agnostic, cached) ----------------------------

  const planPath = path.join(episodeDir, `plan${planSuffix}.json`);
  const plan = await buildOrLoadPlan({ episode, clip, units, refMode, episodeDir, planPath, force: values.force });

  if (planOnly) {
    log('');
    log(`[${num}] plan ready (--plan-only) -> ${path.relative(process.cwd(), planPath)}`);
    log(`[${num}] ${plan.utterances.length} ${units} unit(s), ref-mode ${refMode}, ${Object.keys(plan.refs).length} ref(s)`);
    return;
  }

  // --- STAGE 2: SYNTH (per engine) ----------------------------------------

  await synthFromPlan({
    plan,
    planPath,
    engine,
    enginePython,
    adapterPath,
    episodeDir,
    planSuffix,
    units,
    refMode,
    fit: values.fit,
    force: values.force,
  });
}

// ===========================================================================
// STAGE 1 — PLAN
// ===========================================================================

/**
 * Builds the engine-agnostic plan (or loads the cached one unless --force).
 *
 * Side effects: ensures the source mp3 is cached, extracts reference wavs
 * (+ .txt sidecars), and writes the plan json. Returns the plan.
 *
 * The plan shape is stable across both new options:
 *   - utterances: [{ id, speaker, en, start, end, intensity }]  (turns are
 *     merged units with the SAME field shape — see buildUnits; intensity is
 *     0..1 emotional arousal, the MAX over a turn's merged utterances)
 *   - ref_mode: 'fixed' | 'source'
 *   - refs: in 'fixed' mode keyed by SPEAKER ({ wav, text }); in 'source' mode
 *     keyed by UNIT id ({ wav, text }) since each unit clones from its own span.
 */
async function buildOrLoadPlan({ episode, clip, units, refMode, episodeDir, planPath, force }) {
  const { num } = episode;

  if (!force && fs.existsSync(planPath)) {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const refCount = Object.keys(plan.refs).length;
    log(`[${num}] plan: cached (skip) ${path.relative(process.cwd(), planPath)}`);
    log(`[${num}] plan: ${plan.utterances.length} ${units} unit(s), ref-mode ${plan.ref_mode}, ${refCount} ref(s)`);
    // Sanity: the cached reference wavs (per-speaker for fixed, per-unit for
    // source) must still be on disk.
    for (const [key, ref] of Object.entries(plan.refs)) {
      if (!existsNonEmpty(ref.wav)) {
        throw new Error(
          `plan references a missing reference wav for ${plan.ref_mode === 'source' ? 'unit' : 'speaker'} ${key}: ${ref.wav}\n` +
            `Re-run with --force to recompute the plan.`,
        );
      }
    }
    return plan;
  }

  // --- Ensure source mp3 is cached (reuse the download helper) ------------

  const audio = await downloadAudio(episode);
  log(`[${num}] audio: ${audio.cached ? 'cached (skip)' : 'downloaded'} ${path.relative(process.cwd(), audio.path)}`);

  // --- Load raw diarized ASR ----------------------------------------------

  const asrPath = path.join(ASR_CACHE_DIR, `${num}.json`);
  if (!fs.existsSync(asrPath)) {
    throw new Error(
      `ASR cache missing at ${path.relative(process.cwd(), asrPath)}.\n` +
        `Transcribe the episode first:  yarn transcribe ${num}`,
    );
  }
  const asr = JSON.parse(fs.readFileSync(asrPath, 'utf8'));
  // Real words only; keep just the fields segments.mjs needs. Raw ASR KEEPS the
  // disfluencies we want to translate — this is not the cleaned-up transcript.
  const rawWords = (asr.response?.words ?? [])
    .filter((w) => w.type !== 'spacing' && w.start != null && w.end != null)
    .map((w) => ({ text: w.text, start: w.start, end: w.end, speaker_id: w.speaker_id }));
  if (rawWords.length === 0) {
    throw new Error(`ASR cache at ${path.relative(process.cwd(), asrPath)} has no timed words`);
  }

  // Full-episode segmentation: phantom-speaker merge, then build utterances.
  // The FULL set is used to pick clean reference clips per speaker; a
  // clip-restricted subset is what we translate + synthesise.
  const words = mergePhantomSpeakers(rawWords);
  const allUtterances = buildSegments(words);

  const clipUtterances = clip
    ? allUtterances.filter((u) => u.end > clip.start && u.start < clip.end)
    : allUtterances;
  if (clipUtterances.length === 0) {
    throw new Error(`no utterances fall within --clip ${fmt(clip.start)}-${fmt(clip.end)}`);
  }

  const speakers = [...new Set(clipUtterances.map((u) => u.speaker))];
  const clipLabel = clip ? ` (clip ${fmt(clip.start)}-${fmt(clip.end)})` : '';
  log(`[${num}] utterances: ${clipUtterances.length}${clipLabel}, ${speakers.length} speaker(s): ${speakers.join(', ')}`);

  // Speaker -> display-name map: reuse the already-published transcript (cheap,
  // already paid for); fall back to the raw diarization id when absent.
  const speakerNames = loadSpeakerNames(num, speakers);

  // --- Translate clip utterances FR->EN (disfluencies preserved) ----------
  //
  // CRITICAL: translation always runs PER ORIGINAL UTTERANCE, before any turn
  // merge, so translation quality is identical regardless of --units. For turns
  // the per-utterance English strings are concatenated afterward.

  // Log the Claude backend prominently so the subscription path is confirmable.
  const backend = await detectBackend({ log });
  log(`[${num}] translation backend: ${backend.type.toUpperCase()} (${backend.label})`);

  const translations = await translateUtterances({ num, utterances: clipUtterances });
  log(`[${num}] translation cost: $${translations.costUsd.toFixed(4)} (${backend.type === 'cli' ? 'subscription, $0 on the CLI' : 'SDK estimate'})`);

  // --- Build synthesis UNITS (utterances, or merged same-speaker turns) ----
  //
  // Each unit carries: id, speaker, en (joined translations), start/end (span),
  // fr (joined raw French of the span — needed for source-mode ref_text), and
  // intensity (0..1 emotional arousal; on a turn merge this is the MAX of the
  // merged utterances' intensities — see buildUnits).
  const units_ = buildUnits({ num, clipUtterances, translations, units });
  if (units === 'turn') {
    log(`[${num}] units: merged ${clipUtterances.length} utterance(s) -> ${units_.length} turn(s) (<= ${TURN_MAX_SEC}s each)`);
  }

  // --- References ---------------------------------------------------------
  //
  // fixed:  one fluency-selected clean reference per SPEAKER (engine clones a
  //         consistent clean voice). refs keyed by speaker.
  // source: each UNIT clones from its OWN source-audio span (the real moment,
  //         carrying the speaker's true delivery cross-lingually). refs keyed
  //         by unit id; ref_text is that span's FRENCH.
  const refs =
    refMode === 'source'
      ? buildSourceRefs({ num, episodeDir, audio, units: units_ })
      : buildFixedRefs({ num, episodeDir, audio, words, speakers });

  // --- Assemble + write the plan ------------------------------------------

  const lang = resolveLanguage(num);
  const plan = {
    num: String(num),
    clip: clip ? [clip.start, clip.end] : null,
    source_lang: lang.tag,
    target_lang: 'en',
    units,
    ref_mode: refMode,
    speakers: speakerNames,
    refs,
    // Stable field shape regardless of --units: turns are merged units that
    // still expose exactly { id, speaker, en, start, end, intensity }. intensity
    // (0..1, turn = MAX of merged parts) drives per-unit TTS expressiveness.
    utterances: units_.map((u) => ({
      id: u.id,
      speaker: u.speaker,
      en: u.en,
      start: u.start,
      end: u.end,
      intensity: u.intensity,
    })),
  };

  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  log(`[${num}] plan: written -> ${path.relative(process.cwd(), planPath)}`);
  return plan;
}

/**
 * Builds synthesis units from translated clip utterances.
 *
 * 'utterance' (default): one unit per ASR utterance — original behavior.
 *
 * 'turn': MERGE consecutive utterances by the SAME speaker into one unit, as
 * long as the merged span stays <= TURN_MAX_SEC and no other speaker speaks in
 * between (i.e. only adjacent same-speaker utterances merge — a speaker change
 * always breaks the run). The merged unit's start = first.start, end = last.end,
 * en = the per-utterance English joined with a space, fr = the per-utterance raw
 * French joined with a space, speaker = that speaker. Units are re-id'd
 * sequentially from 0 so downstream filenames/refs are stable.
 *
 * Emotional intensity (0..1) is carried per unit. On a turn merge it aggregates
 * as the MAX of the merged utterances' intensities: a turn should be voiced as
 * expressively as its MOST heated part, so one shouted line inside an otherwise
 * calm turn still gets a dramatic delivery (a mean would dilute that peak into
 * blandness, which is exactly the flat-everything failure we're fixing).
 *
 * Returns [{ id, speaker, en, fr, start, end, intensity }].
 */
function buildUnits({ num, clipUtterances, translations, units }) {
  const enFor = (u) => {
    const en = translations.byId.get(u.id);
    if (en == null) {
      throw new Error(`translation missing for utterance ${u.id} ("${u.text.slice(0, 40)}…")`);
    }
    return en;
  };
  // Per-utterance intensity from translation; neutral 0.4 if somehow absent.
  const intensityFor = (u) => {
    const v = translations.intensityById?.get(u.id);
    return Number.isFinite(v) ? v : 0.4;
  };

  if (units === 'utterance') {
    // One unit per utterance, but still expose `fr` for source ref_text and
    // re-id sequentially so ids are dense + mode-independent.
    return clipUtterances.map((u, id) => ({
      id,
      speaker: u.speaker,
      en: enFor(u),
      fr: u.text,
      start: u.start,
      end: u.end,
      intensity: round2(intensityFor(u)),
    }));
  }

  // units === 'turn'
  const merged = [];
  let current = null;
  for (const u of clipUtterances) {
    const en = enFor(u);
    const intensity = intensityFor(u);
    const sameSpeaker = current && current.speaker === u.speaker;
    const fitsSpan = current && u.end - current.start <= TURN_MAX_SEC;
    if (sameSpeaker && fitsSpan) {
      // Extend the open turn with this same-speaker utterance. Intensity is the
      // MAX over the turn's utterances (most-heated part wins; see doc above).
      current.en = `${current.en} ${en}`;
      current.fr = `${current.fr} ${u.text}`;
      current.end = u.end;
      current.intensity = Math.max(current.intensity, intensity);
    } else {
      // Speaker change, over-long span, or first utterance: open a new turn.
      current = { speaker: u.speaker, en, fr: u.text, start: u.start, end: u.end, intensity };
      merged.push(current);
    }
  }

  // Re-id sequentially and round the aggregated intensity for a clean plan.
  return merged.map((u, id) => ({ id, ...u, intensity: round2(u.intensity) }));
}

/**
 * 'fixed' ref-mode: one fluency-selected clean reference clip per speaker
 * (original behavior). Extracts ref-{speaker}.wav (+ .txt sidecar) from the
 * full-episode audio and returns refs keyed by speaker.
 */
function buildFixedRefs({ num, episodeDir, audio, words, speakers }) {
  const refs = {};
  for (const speaker of speakers) {
    const ref = pickReferenceWindow(words, speaker);
    if (!ref) {
      throw new Error(`could not find a usable reference window for speaker ${speaker} in episode ${num}`);
    }
    const refPath = path.join(episodeDir, `ref-${speaker}.wav`);
    // The plan rebuild always re-extracts: the window choice may have changed.
    log(
      `[${num}] ref ${speaker}: ${fmt(ref.start)}-${fmt(ref.end)} (${fmt(ref.end - ref.start)}, ` +
        `fluency ${ref.score.toFixed(2)}) -> ${path.basename(refPath)}`,
    );
    runFfmpeg([
      '-y',
      '-ss', String(ref.start),
      '-to', String(ref.end),
      '-i', audio.path,
      '-vn',
      '-ac', '1',
      '-acodec', 'pcm_s16le',
      refPath,
    ], `extracting reference clip for ${speaker}`);
    // Persist the reference TEXT sidecar too: some engines want ref-text, and it
    // documents which voice sample we cloned (the plan also embeds it).
    fs.writeFileSync(`${refPath}.txt`, ref.text);
    refs[speaker] = { wav: refPath, text: ref.text };
  }
  return refs;
}

/**
 * 'source' ref-mode: each UNIT clones from its OWN source-audio span. For every
 * unit, extract [start,end] from the cached episode mp3 (mono PCM) to
 * .dub-cache/{num}/refsrc-{id}.wav — refs are engine-agnostic, so they live at
 * the episode root, NOT under an engine dir. ref_text is the unit's FRENCH
 * source text (the joined raw ASR words in the span, carried on unit.fr).
 * Returns refs keyed by UNIT id.
 */
function buildSourceRefs({ num, episodeDir, audio, units }) {
  const refs = {};
  for (const u of units) {
    const refPath = path.join(episodeDir, `refsrc-${u.id}.wav`);
    log(
      `[${num}] ref unit ${u.id} (${u.speaker}): source ${fmt(u.start)}-${fmt(u.end)} ` +
        `(${fmt(u.end - u.start)}) -> ${path.basename(refPath)}`,
    );
    runFfmpeg([
      '-y',
      '-ss', String(u.start),
      '-to', String(u.end),
      '-i', audio.path,
      '-vn',
      '-ac', '1',
      '-acodec', 'pcm_s16le',
      refPath,
    ], `extracting source reference clip for unit ${u.id}`);
    fs.writeFileSync(`${refPath}.txt`, u.fr);
    refs[u.id] = { wav: refPath, text: u.fr };
  }
  return refs;
}

/**
 * Speaker-id -> display-name map. Prefers the already-published transcript's
 * `speakers` (computed once during `yarn transcribe`, so $0 here); for any id
 * not present there (or if no transcript exists yet) falls back to the raw id.
 */
function loadSpeakerNames(num, speakers) {
  let mapped = {};
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${num}.json`);
  if (fs.existsSync(transcriptPath)) {
    try {
      mapped = JSON.parse(fs.readFileSync(transcriptPath, 'utf8')).speakers ?? {};
    } catch {
      mapped = {};
    }
  }
  const names = {};
  for (const speaker of speakers) names[speaker] = mapped[speaker] ?? speaker;
  return names;
}

// ===========================================================================
// STAGE 2 — SYNTH
// ===========================================================================

/**
 * Writes the per-engine synth manifest, invokes the engine adapter ONCE in
 * batch, then reassembles the engine's per-unit wavs on the original timeline to
 * .dub-cache/{num}/cascade-en.{engine}{planSuffix}.mp3 (planSuffix already
 * encodes the clip range + --units + --ref-mode so variants never collide).
 */
async function synthFromPlan({ plan, planPath, engine, enginePython, adapterPath, episodeDir, planSuffix, units, refMode, fit, force }) {
  const num = plan.num;

  // Per-engine intermediates are namespaced by engine AND by variant so
  // utterance/turn × fixed/source runs of the same episode never collide.
  const engineDir = path.join(episodeDir, `${engine}${planSuffix}`);
  fs.mkdirSync(engineDir, { recursive: true });

  // --- Build the per-engine synth manifest --------------------------------
  //
  // Manifest item shape: { id, ref, ref_text, text, lang, out, intensity,
  // exaggeration, cfg_weight }. Ref resolution depends on the plan's ref_mode:
  // fixed -> per-speaker ref (plan.refs[speaker]); source -> per-unit ref
  // (plan.refs[id]).
  //
  // EMOTION-ADAPTIVE: each item carries its own `exaggeration`/`cfg_weight`
  // derived from the unit's intensity (see intensityToExaggeration), so the TTS
  // delivers calm lines flat and heated ones dramatically. These are
  // engine-agnostic hints; only the chatterbox adapter consumes them for now,
  // and even then only the knobs its generate() accepts (it falls back to its
  // env/global default per missing knob). `intensity` is included for
  // traceability/debugging. Older plans cached before this change have no
  // intensity field -> treated as neutral 0.4.
  const manifest = plan.utterances.map((u) => {
    const ref = plan.ref_mode === 'source' ? plan.refs[u.id] : plan.refs[u.speaker];
    if (!ref) {
      const kind = plan.ref_mode === 'source' ? `unit ${u.id}` : `speaker ${u.speaker}`;
      throw new Error(`plan has no reference for ${kind} (unit ${u.id})`);
    }
    const intensity = Number.isFinite(u.intensity) ? u.intensity : 0.4;
    return {
      id: u.id,
      ref: ref.wav,
      ref_text: ref.text,
      text: u.en,
      lang: plan.target_lang,
      out: path.join(engineDir, `tts-${u.id}.wav`),
      intensity,
      exaggeration: intensityToExaggeration(intensity),
      cfg_weight: intensityToCfgWeight(intensity),
    };
  });

  const synthManifestPath = path.join(episodeDir, `synth-${engine}${planSuffix}.json`);
  fs.writeFileSync(synthManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`[${num}] synth manifest -> ${path.relative(process.cwd(), synthManifestPath)} (${manifest.length} item(s), ${units}/${refMode})`);

  // --- Invoke the engine adapter ONCE in batch (model loads once) ---------

  const needsSynth = force || manifest.some((m) => !existsNonEmpty(m.out));
  if (needsSynth) {
    log(`[${num}] synth: ${engine} adapter (batch, ${manifest.length} item(s))…`);
    await runEngineBatch({ enginePython, adapterPath, manifestPath: synthManifestPath, force, label: `${engine} batch synth` });
  } else {
    log(`[${num}] synth: all ${manifest.length} item(s) cached (skip); pass --force to re-synthesise`);
  }
  for (const m of manifest) {
    if (!existsNonEmpty(m.out)) {
      throw new Error(`engine ${engine} produced no output for utterance ${m.id} at ${m.out}`);
    }
  }

  // --- Reassemble on the original timeline --------------------------------

  const segments = [];
  for (let i = 0; i < plan.utterances.length; i++) {
    const utt = plan.utterances[i];
    const ttsPath = manifest[i].out;
    // Inter-utterance silence: the ORIGINAL gap before this utterance, clamped.
    if (i > 0) {
      const prev = plan.utterances[i - 1];
      const gap = clamp(utt.start - prev.end, 0, MAX_GAP_SEC);
      if (gap > 0) segments.push(makeSilence(engineDir, utt.id, gap));
    }
    segments.push(maybeFit({ ttsPath, utt, fit, engineDir, num }));
  }

  const outPath = path.join(episodeDir, `cascade-en.${engine}${planSuffix}.mp3`);
  concatToMp3(segments, outPath, engineDir);

  const outDuration = probeDuration(outPath);
  const srcSpan = plan.clip
    ? plan.clip[1] - plan.clip[0]
    : plan.utterances[plan.utterances.length - 1].end - plan.utterances[0].start;
  log('');
  log(`[${num}] done (${engine}) -> ${path.relative(process.cwd(), outPath)}`);
  log(`[${num}] duration: dubbed ${fmt(outDuration)}  vs  source clip ${fmt(srcSpan)}`);
}

/**
 * Runs the engine adapter once over the whole synth manifest. The adapter loads
 * its model a single time and loops the items. stderr is streamed so the device
 * choice + per-item progress are visible live.
 */
function runEngineBatch({ enginePython, adapterPath, manifestPath, force, label }) {
  return new Promise((resolve, reject) => {
    const args = [adapterPath, '--manifest', manifestPath];
    if (force) args.push('--force');
    const child = spawn(enginePython, args, {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'inherit', 'inherit'],
      // COQUI_TOS_AGREED lets XTTS download its model non-interactively; the
      // adapter sets it too, but exporting here covers any engine.
      env: { ...process.env, COQUI_TOS_AGREED: process.env.COQUI_TOS_AGREED ?? '1' },
    });
    child.on('error', (error) => {
      reject(new Error(`TTS adapter spawn failed for ${label}: ${error.message}`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`TTS adapter failed for ${label} (exit ${code}). Command: ${enginePython} ${args.join(' ')}`));
        return;
      }
      resolve();
    });
  });
}

// ===========================================================================
// Reference clip selection — FLUENCY-SCORED (anti-ramble lever #1)
// ===========================================================================

/**
 * Picks the most FLUENT ~6-10s single-speaker window for `speaker`. Instead of
 * the longest contiguous run (which often includes fillers, repetitions and
 * false starts that make XTTS clone a hesitant voice and ramble), we slide a
 * REF_TARGET_SEC window across every contiguous single-speaker run and keep the
 * lowest-disfluency one of roughly the target length.
 *
 * Scoring (LOWER is better) penalises:
 *   - adjacent repeated tokens ("le le", "je je"),
 *   - French filler/hesitation tokens (euh, bah, ben, hein, heu, hum, …),
 *   - very short average word length (lots of monosyllabic filler),
 *   - deviation from REF_TARGET_SEC of continuous speech.
 *
 * @param {Array<{ text: string, start: number, end: number, speaker_id: string }>} words
 * @param {string} speaker
 * @returns {?{ start: number, end: number, text: string, score: number }}
 */
function pickReferenceWindow(words, speaker) {
  const runs = contiguousRuns(words, speaker);
  if (runs.length === 0) return null;

  let best = null;
  for (const run of runs) {
    for (const window of slideWindows(run)) {
      const score = scoreWindow(window);
      if (!best || score < best.score) best = { ...window, score };
    }
  }
  if (!best) return null;

  const text = best.words
    .map((w) => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { start: round3(best.start), end: round3(best.end), text, score: best.score };
}

/** Splits the stream into maximal contiguous runs of `speaker`'s words. */
function contiguousRuns(words, speaker) {
  const runs = [];
  let run = null;
  for (const w of words) {
    if (w.speaker_id === speaker) {
      if (!run) {
        run = [];
        runs.push(run);
      }
      run.push(w);
    } else {
      run = null;
    }
  }
  return runs;
}

/**
 * Yields candidate ~REF_TARGET_SEC windows inside a run: a sliding window that
 * grows word-by-word and, once it covers >= REF_MIN_SEC, is emitted (trimmed at
 * REF_MAX_SEC) before the left edge advances. Short runs that never reach
 * REF_MIN_SEC still emit one (shorter-than-target) window so a speaker with only
 * brief turns is not left without a reference.
 */
function* slideWindows(run) {
  if (run.length === 0) return;
  const runLen = run[run.length - 1].end - run[0].start;

  // Whole short run: best we can do.
  if (runLen < REF_MIN_SEC) {
    yield makeWindow(run);
    return;
  }

  for (let i = 0; i < run.length; i++) {
    let j = i;
    while (j < run.length && run[j].end - run[i].start < REF_TARGET_SEC) j += 1;
    // [i, j] now spans >= REF_TARGET_SEC (or hit the run end). Clamp to REF_MAX_SEC.
    while (j < run.length && run[j].end - run[i].start <= REF_MAX_SEC) j += 1;
    const slice = run.slice(i, Math.max(i + 1, j));
    const span = slice[slice.length - 1].end - slice[0].start;
    if (span >= REF_MIN_SEC) yield makeWindow(slice);
  }
}

function makeWindow(slice) {
  return { words: slice, start: slice[0].start, end: slice[slice.length - 1].end };
}

/** Disfluency-aware score for a candidate reference window (LOWER is better). */
function scoreWindow(window) {
  const tokens = window.words.map((w) => normToken(w.text)).filter(Boolean);
  if (tokens.length === 0) return Infinity;

  const span = window.end - window.start;

  let fillers = 0;
  let repeats = 0;
  let letterCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (FILLER_TOKENS.has(t)) fillers += 1;
    if (i > 0 && t === tokens[i - 1]) repeats += 1; // adjacent repetition
    letterCount += t.length;
  }
  const avgWordLen = letterCount / tokens.length;

  // Component weights (each is a per-window penalty; lower total = cleaner).
  const fillerPenalty = (fillers / tokens.length) * 6; // fraction of fillers, heavily penalised
  const repeatPenalty = (repeats / tokens.length) * 8; // stutters/repetitions, the worst for XTTS
  const shortWordPenalty = Math.max(0, 3 - avgWordLen) * 0.8; // monosyllabic-filler-heavy speech
  const lengthPenalty = Math.abs(span - REF_TARGET_SEC) * 0.15; // prefer ~REF_TARGET_SEC of speech

  return fillerPenalty + repeatPenalty + shortWordPenalty + lengthPenalty;
}

/** Lowercases and strips surrounding punctuation for token comparison. */
function normToken(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// ===========================================================================
// Translation
// ===========================================================================

/**
 * Translates the utterances FR->EN in batches via runStructuredPrompt,
 * preserving disfluencies. Each item also carries an `intensity` (0..1) rating
 * of the utterance's emotional arousal, used downstream for per-turn
 * EMOTION-ADAPTIVE expressiveness. Returns { byId, intensityById, costUsd }
 * where byId: Map<id, en> and intensityById: Map<id, number 0..1>.
 */
async function translateUtterances({ num, utterances }) {
  const byId = new Map();
  const intensityById = new Map();
  let costUsd = 0;

  const batchCount = Math.ceil(utterances.length / TRANSLATE_BATCH);
  for (let b = 0; b < batchCount; b++) {
    const batch = utterances.slice(b * TRANSLATE_BATCH, (b + 1) * TRANSLATE_BATCH);
    const prompt = buildTranslationPrompt(batch.map(({ id, text }) => ({ id, text })));

    let result;
    try {
      result = await runStructuredPrompt({ prompt, schema: TRANSLATION_SCHEMA, log });
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        throw new Error(`Claude quota exhausted during translation: ${error.message}`);
      }
      throw new Error(`translation batch ${b + 1}/${batchCount} failed: ${error.message}`);
    }
    costUsd += result.costUsd;

    const items = result.output?.items;
    if (!Array.isArray(items)) {
      throw new Error(`translation batch ${b + 1}/${batchCount} returned no "items" array`);
    }
    for (const item of items) {
      if (typeof item?.id === 'number' && typeof item?.en === 'string') {
        byId.set(item.id, item.en);
        // Clamp the model's intensity to [0,1]; default a missing/garbage value
        // to 0.4 (neutral) so a flaky rating never breaks the pipeline. Use
        // Number.isFinite so a legitimate 0 (truly flat) is NOT overwritten.
        const raw = Number(item.intensity);
        intensityById.set(item.id, Number.isFinite(raw) ? clamp(raw, 0, 1) : 0.4);
      }
    }
    log(`[${num}] translate: batch ${b + 1}/${batchCount} ok (${batch.length} utt, cost so far $${costUsd.toFixed(4)})`);
  }

  // Every utterance must have a translation before we spend TTS time.
  const missing = utterances.filter((u) => !byId.has(u.id));
  if (missing.length > 0) {
    throw new Error(`translation missing for ${missing.length} utterance(s) (first id ${missing[0].id})`);
  }
  return { byId, intensityById, costUsd };
}

// ===========================================================================
// Reassembly
// ===========================================================================

/**
 * Returns the concat-segment path for an utterance. With --fit, the TTS clip is
 * time-stretched toward its original slot duration via ffmpeg atempo, clamped to
 * [FIT_MIN_TEMPO, FIT_MAX_TEMPO]; outside that range the stretch is skipped (it
 * would distort the voice) and the raw clip is used as-is. Fit artifacts are
 * keyed by utterance id under the engine dir.
 */
function maybeFit({ ttsPath, utt, fit, engineDir, num }) {
  if (!fit) return ttsPath;

  const slot = utt.end - utt.start;
  const ttsDur = probeDuration(ttsPath);
  if (!(slot > 0) || !(ttsDur > 0)) return ttsPath;

  // atempo > 1 speeds up (shortens). To map ttsDur -> slot, tempo = ttsDur/slot.
  const tempo = ttsDur / slot;
  if (tempo < FIT_MIN_TEMPO || tempo > FIT_MAX_TEMPO) {
    log(`[${num}] fit ${utt.id}: tempo ${tempo.toFixed(2)}x outside [${FIT_MIN_TEMPO},${FIT_MAX_TEMPO}] — skipping stretch`);
    return ttsPath;
  }

  const fitPath = path.join(engineDir, `fit-${utt.id}.wav`);
  runFfmpeg([
    '-y',
    '-i', ttsPath,
    '-filter:a', `atempo=${tempo.toFixed(4)}`,
    '-acodec', 'pcm_s16le',
    fitPath,
  ], `time-stretching utterance ${utt.id}`);
  return fitPath;
}

/** Generates (and caches) a mono PCM silence wav of `seconds` for the gap. */
function makeSilence(engineDir, id, seconds) {
  const silPath = path.join(engineDir, `gap-${id}.wav`);
  runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=mono:sample_rate=24000',
    '-t', seconds.toFixed(3),
    '-acodec', 'pcm_s16le',
    silPath,
  ], `generating ${seconds.toFixed(2)}s gap`);
  return silPath;
}

/** Concatenates wav segments (in order) into an mp3 via ffmpeg's concat demuxer. */
function concatToMp3(files, outPath, scratchDir) {
  const listPath = path.join(scratchDir, 'cascade-concat.txt');
  const listBody = files
    .map((f) => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listPath, `${listBody}\n`);

  runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    // Sample rates differ (TTS vs the 24kHz silence) — let ffmpeg resample.
    '-ar', '24000',
    '-ac', '1',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outPath,
  ], 'concatenating cascade segments');

  fs.rmSync(listPath, { force: true });
}

// ===========================================================================
// External tools
// ===========================================================================

function runFfmpeg(args, context) {
  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed while ${context} (exit ${result.status})`);
  }
}

/** Returns the duration in seconds of a media file via ffprobe. */
function probeDuration(filePath) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed on ${filePath}: ${(result.stderr ?? '').trim()}`);
  }
  const seconds = Number(String(result.stdout).trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe returned a non-numeric duration for ${filePath}`);
  }
  return seconds;
}

/** Throws a clear error if a required CLI tool is not on PATH. */
function ensureTool(name) {
  const probe = spawnSync(name, ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(`${name} not found on PATH. Install it (e.g. \`brew install ffmpeg\`).`);
  }
}

// ===========================================================================
// Small helpers
// ===========================================================================

/** Parses "<startSec>:<endSec>" into { start, end } (seconds). */
function parseClip(raw) {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) throw new Error(`--clip must be "<startSec>:<endSec>" (e.g. 2275:2346), got "${raw}"`);
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end <= start) throw new Error(`--clip end (${end}) must be greater than start (${start})`);
  return { start, end };
}

function existsNonEmpty(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Formats seconds as m:ss for readable logs. */
function fmt(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${rem}`;
}
