#!/usr/bin/env node
// scripts/transcribe.mjs
//
// Episode transcription pipeline for septanteminutes.be.
//
//   yarn transcribe 84 85          transcribe specific episodes
//   yarn transcribe --season latest
//   yarn transcribe --all --missing
//
// Stages (each skipped when its artifact already exists):
//   download mp3 -> ElevenLabs Scribe ASR (cached) -> deterministic
//   segmentation -> Claude post-pass -> public/transcripts/{num}.{json,vtt}
//   -> manifest.json rebuild.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { TRANSCRIPTS_DIR, AUDIO_CACHE_DIR, ASR_CACHE_DIR, SCHEMA_VERSION, resolveLanguage } from './transcribe/config.mjs';
import { loadEpisodes, resolveSelection, hasTranscript } from './transcribe/episodes.mjs';
import { downloadAudio } from './transcribe/download.mjs';
import { transcribeAudio } from './transcribe/asr.mjs';
import { buildSegments, mergePhantomSpeakers, alignWordsToText } from './transcribe/segments.mjs';
import { detectBackend, getResolvedModel } from './transcribe/llm.mjs';
import { postProcess } from './transcribe/postprocess.mjs';
import { transcriptToVtt } from './transcribe/vtt.mjs';
import { rebuildManifest } from './transcribe/manifest.mjs';
import { startBounded } from './transcribe/concurrency.mjs';
import { QuotaExhaustedError } from './transcribe/llm.mjs';

const HELP = `Usage: yarn transcribe [episodes...] [options]

Selection:
  84 85 ...          positional episode numbers (ranges allowed: 84-94)
  --season <name>    all episodes of a season ("latest" for the newest one)
  --all              every episode in data.json
  --missing          only episodes without a committed transcript
                     (implies --all when no other selection is given)

Behavior:
  --force            re-run ASR and the Claude post-pass even when cached
  --redo-claude      re-run the Claude post-pass from the cached ASR
                     (does not re-pay ElevenLabs)
  --redo-asr         clear the ASR cache for selected episodes and re-fetch
                     from ElevenLabs (does not skip Claude — post-cache
                     naturally misses when segments change)
  --resume           skip episodes that already have a committed transcript
                     even when --redo-claude is set; useful for continuing
                     an interrupted run
  --concurrency <n>  correction chunks processed in parallel (default 1, max 8)
  --asr-concurrency <n>
                     episodes whose ElevenLabs ASR is fetched in parallel
                     (default 4, max 12; ElevenLabs is pay-per-use, not
                     subscription-throttled like the Claude pass)
  --enrich-words     patch word-level timestamps into existing public transcripts
                     from the cached ASR (no ElevenLabs or Claude re-runs)
  --asr-only         stop after caching the ASR response (no outputs written)
  --dry-run          print what would happen; no network, LLM or file writes
  -h, --help         show this help`;

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      season: { type: 'string' },
      all: { type: 'boolean', default: false },
      missing: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'redo-claude': { type: 'boolean', default: false },
      'redo-asr': { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '1' },
      'asr-concurrency': { type: 'string', default: '4' },
      'enrich-words': { type: 'boolean', default: false },
      'asr-only': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  if (!/^[1-8]$/.test(values.concurrency)) {
    throw new Error(`--concurrency must be an integer between 1 and 8, got "${values.concurrency}"`);
  }

  if (!/^([1-9]|1[0-2])$/.test(values['asr-concurrency'])) {
    throw new Error(`--asr-concurrency must be an integer between 1 and 12, got "${values['asr-concurrency']}"`);
  }

  const flags = {
    force: values.force,
    redoClaude: values['redo-claude'],
    redoAsr: values['redo-asr'],
    resume: values.resume,
    enrichWords: values['enrich-words'],
    asrOnly: values['asr-only'],
    dryRun: values['dry-run'],
    concurrency: Number(values.concurrency),
    asrConcurrency: Number(values['asr-concurrency']),
  };

  const episodes = resolveSelection(loadEpisodes(), {
    nums: positionals,
    season: values.season,
    all: values.all,
    missing: values.missing,
  });

  console.log(
    `Selected ${episodes.length} episode(s): ${episodes.map((ep) => ep.num).join(', ')}` +
      (flags.dryRun ? ' (dry run — no network, LLM or file writes)' : ''),
  );

  if (flags.enrichWords) {
    const results = await enrichWordsRun(episodes);
    const manifest = rebuildManifest();
    console.log(`manifest: ${manifest.episodes.length} episode(s) [${manifest.episodes.join(', ')}]`);
    printSummary(results);
    if (results.some((r) => r.status === 'failed')) process.exitCode = 1;
    return;
  }

  if (flags.redoAsr && !flags.dryRun) {
    for (const ep of episodes) {
      const cachePath = path.join(ASR_CACHE_DIR, `${ep.num}.json`);
      if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath);
        console.log(`[${ep.num}] asr: cache cleared (--redo-asr)`);
      }
    }
  }

  const results = flags.dryRun ? runDryRun(episodes, flags) : await runPipeline(episodes, flags);

  if (!flags.dryRun && !flags.asrOnly) {
    const manifest = rebuildManifest();
    console.log(`manifest: ${manifest.episodes.length} episode(s) [${manifest.episodes.join(', ')}]`);
  }

  printSummary(results);

  if (results.some((result) => result.status === 'failed')) {
    process.exitCode = 1;
  }
}

// Producer/consumer pipeline. Two stages with very different cost models run
// concurrently instead of in two separate phases:
//
//   ASR producer  — download + ElevenLabs Scribe (pay-per-use, no subscription
//                   throttle) — runs AHEAD, up to `asrConcurrency` episodes in
//                   parallel; completion order doesn't matter.
//   Claude consumer — segments + Opus post-pass + write — stays STRICTLY
//                   SEQUENTIAL and IN EPISODE ORDER (one at a time) to respect
//                   the subscription rate limit. It must never be parallelised.
//
// `startBounded` exposes a per-episode promise; the consumer awaits episode i's
// ASR and runs its post-pass as soon as that ASR is ready — it does NOT wait for
// the whole ASR batch. Because the producer is bounded-parallel and started
// ahead (and per-episode ASR is usually faster than the rate-limited Claude
// pass), `await asrResults[i]` typically resolves immediately, so Claude starts
// right after episode 1's ASR and rarely waits thereafter.
/**
 * --enrich-words: patch word-level timestamps into existing public transcripts
 * using cached ASR data. No ElevenLabs or Claude calls are made.
 */
async function enrichWordsRun(episodes) {
  const results = [];
  for (const episode of episodes) {
    const { num } = episode;
    const asrCachePath = path.join(ASR_CACHE_DIR, `${num}.json`);
    const jsonPath = path.join(TRANSCRIPTS_DIR, `${num}.json`);
    try {
      if (!fs.existsSync(asrCachePath)) {
        throw new Error(`ASR cache missing — run without --enrich-words first to transcribe this episode`);
      }
      if (!fs.existsSync(jsonPath)) {
        throw new Error(`public transcript missing — run without --enrich-words first`);
      }
      const asrCache = JSON.parse(fs.readFileSync(asrCachePath, 'utf8'));
      const rawWords = mergePhantomSpeakers(asrCache.response.words ?? []);
      const rebuiltSegments = buildSegments(rawWords);
      const rebuiltById = new Map(rebuiltSegments.map((seg) => [seg.id, seg]));
      const transcript = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      let patched = 0;
      for (const segment of transcript.segments) {
        const rebuilt = rebuiltById.get(segment.id);
        if (rebuilt?.words) {
          segment.words = alignWordsToText(segment.text, rebuilt.words);
          patched += 1;
        }
      }
      fs.writeFileSync(jsonPath, `${JSON.stringify(transcript)}\n`);
      console.log(`[${num}] enrich-words: ${patched}/${transcript.segments.length} segments patched`);
      results.push({ num, status: 'ok', detail: `${patched}/${transcript.segments.length} segments` });
    } catch (error) {
      console.error(`[${num}] failed: ${error.message}`);
      results.push({ num, status: 'failed', detail: error.message });
    }
  }
  return results;
}

async function runPipeline(episodes, flags) {
  const log = console.log;

  // Mirror the skip rule: a plain run with committed outputs is skipped and
  // needs no ASR. --force/--redo-claude/--redo-asr/--asr-only always run ASR,
  // unless --resume is set and the output already exists (interrupted-run recovery).
  const needsAsr = episodes.map((ep) => {
    if (flags.resume && hasTranscript(ep.num)) return false;
    return flags.force || flags.redoClaude || flags.redoAsr || flags.asrOnly || !hasTranscript(ep.num);
  });
  const pendingCount = needsAsr.filter(Boolean).length;
  if (pendingCount > 0) {
    console.log(`asr: fetching ${pendingCount} episode(s), up to ${flags.asrConcurrency} in parallel…`);
  }

  // Start the bounded-parallel ASR producer. Skipped episodes resolve instantly
  // with `null` so the consumer sees them in order without spending an ASR slot.
  const { results: asrResults, done } = startBounded(episodes, flags.asrConcurrency, (episode, i) =>
    needsAsr[i] ? asrPhase(episode, flags, log) : Promise.resolve(null),
  );

  // --asr-only: no consumer. Just let the producer drain (caching as it goes)
  // and report. Mirrors the previous prefetch-and-stop behaviour.
  if (flags.asrOnly) {
    await done;
    return episodes.map((episode, i) => {
      if (!needsAsr[i]) return { num: episode.num, status: 'skipped', detail: 'output exists' };
      return { num: episode.num, status: 'ok', detail: 'asr cached' };
    });
  }

  // Sequential consumer: episode by episode, in order. Awaiting asrResults[i]
  // pipelines onto the producer — it resolves as soon as episode i's ASR is
  // ready, while later episodes' ASR keeps running in the background.
  const results = [];
  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];
    const { num } = episode;

    if (!needsAsr[i]) {
      log(`[${num}] output: exists (skip — use --force or --redo-claude to regenerate)`);
      results.push({ num, status: 'skipped', detail: 'output exists' });
      continue;
    }

    const asr = await asrResults[i];
    if (!asr.ok) {
      // ASR failed for this episode; isolate it and keep going. The thrown
      // error already carries the failing stage's context.
      console.error(`[${num}] failed: ${asr.error.message}`);
      results.push({ num, status: 'failed', detail: asr.error.message });
      continue;
    }

    try {
      results.push(await postPhase(episode, asr.value, flags, log));
    } catch (error) {
      if (error instanceof QuotaExhaustedError) {
        console.error(`[${num}] quota exhausted — stopping pipeline`);
        results.push({ num, status: 'failed', detail: error.message });
        break;
      }
      console.error(`[${num}] failed: ${error.message}`);
      results.push({ num, status: 'failed', detail: error.message });
    }
  }
  return results;
}

// ASR stage (producer): download the audio and transcribe it (cached to disk).
// Returns `{ modelId }` — the segments are NOT threaded through; the post phase
// re-reads the now-cached ASR response via transcribeAudio (no re-charge),
// keeping at most `asrConcurrency` raw responses live in memory at once.
async function asrPhase(episode, flags, log) {
  const { num } = episode;
  // Audio cache is always reused — re-downloading 70 MB serves nothing.
  const audio = await downloadAudio(episode);
  log(`[${num}] audio: ${audio.cached ? 'cached (skip)' : `downloaded (${sizeMb(audio.path)} MB)`}`);

  // --force re-pays ElevenLabs; --redo-claude reuses the cache.
  const asr = await transcribeAudio(episode, audio.path, { force: flags.force, log });
  log(`[${num}] asr: ${asr.cached ? 'cached (skip)' : `transcribed with ${asr.modelId}`}`);
  return { modelId: asr.modelId };
}

// Post stage (consumer): segmentation + Claude post-pass + outputs. Runs only
// after asrPhase has cached this episode's ASR, so transcribeAudio below is a
// guaranteed cache hit (no second ElevenLabs charge).
async function postPhase(episode, asrInfo, flags, log) {
  const { num } = episode;
  const jsonPath = path.join(TRANSCRIPTS_DIR, `${num}.json`);
  const vttPath = path.join(TRANSCRIPTS_DIR, `${num}.vtt`);

  // Re-read the cached ASR response (cache hit — asrPhase just wrote it).
  const audio = await downloadAudio(episode);
  const asr = await transcribeAudio(episode, audio.path, { force: false, log });

  // Deterministic segmentation (phantom speakers merged first).
  const words = mergePhantomSpeakers(asr.response.words ?? []);
  const segments = buildSegments(words);
  log(`[${num}] segments: ${segments.length}`);

  // Claude post-pass (backend detected lazily, logged once per run).
  // --redo-claude/--force redo corrections from scratch; plain runs reuse
  // validated chunks from the post cache (e.g. after a late-stage failure).
  const backend = await detectBackend({ log });
  const post = await postProcess({
    episode,
    words,
    segments,
    useChunkCache: !flags.redoClaude && !flags.force,
    concurrency: flags.concurrency,
    log,
  });

  // Outputs. The CLI 'opus' alias tracks the latest Opus, so record the
  // concrete model the run actually resolved to (e.g. claude-cli/claude-opus-4-8).
  const postProcessing =
    backend.type === 'cli' && getResolvedModel()
      ? `claude-cli/${getResolvedModel()}`
      : backend.label;
  // Cleanup can legitimately empty pure-disfluency segments — drop them from
  // the outputs (ids keep their gaps; the frontend keys on id, not position).
  const keptSegments = post.segments.filter((segment) => segment.text.trim().length > 0);
  const dropped = post.segments.length - keptSegments.length;
  if (dropped > 0) log(`[${num}] post: dropped ${dropped} pure-disfluency segment(s)`);

  const transcript = {
    version: SCHEMA_VERSION,
    num,
    language: resolveLanguage(num).tag,
    engine: `elevenlabs/${asrInfo.modelId}`,
    postProcessing,
    generatedAt: new Date().toISOString(),
    correctedSegments: post.stats.correctedSegments,
    totalSegments: post.stats.totalSegments,
    speakers: post.speakers,
    segments: keptSegments,
  };
  const vtt = transcriptToVtt(transcript);

  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(transcript)}\n`);
  fs.writeFileSync(vttPath, vtt);
  log(`[${num}] output: wrote ${path.relative(process.cwd(), jsonPath)} + .vtt`);

  return {
    num,
    status: 'ok',
    detail: `${post.stats.correctedSegments}/${post.stats.totalSegments} corrected`,
    costUsd: post.stats.costUsd,
  };
}

/** Dry run: report the planned stages for every episode (no network/LLM/disk). */
function runDryRun(episodes, flags) {
  return episodes.map((episode) => {
    const { num } = episode;
    const skip =
      hasTranscript(num) &&
      (flags.resume || (!flags.force && !flags.redoClaude && !flags.redoAsr && !flags.asrOnly));
    if (skip) {
      console.log(`[${num}] output: exists (skip — use --force or --redo-claude to regenerate)`);
      return { num, status: 'skipped', detail: 'output exists' };
    }
    return dryRunEpisode(episode, flags);
  });
}

/** Prints the planned stages without touching the network, LLM or disk. */
function dryRunEpisode(episode, flags) {
  const { num } = episode;
  const audioCached = fs.existsSync(path.join(AUDIO_CACHE_DIR, `${num}.mp3`));
  const asrCached = fs.existsSync(path.join(ASR_CACHE_DIR, `${num}.json`));

  console.log(`[${num}] audio: ${audioCached ? 'cached (skip)' : 'would download mp3'}`);
  console.log(
    `[${num}] asr: ${asrCached && !flags.force && !flags.redoAsr ? 'cached (skip)' : 'would call ElevenLabs Scribe'}`,
  );
  if (flags.asrOnly) {
    console.log(`[${num}] post: skipped (--asr-only)`);
  } else {
    console.log(`[${num}] post: would run Claude post-pass`);
    console.log(`[${num}] output: would write public/transcripts/${num}.{json,vtt}`);
  }
  return { num, status: 'planned', detail: 'dry run' };
}

function printSummary(results) {
  console.log('\nSummary');
  console.log('  episode  status   detail');
  for (const result of results) {
    const cost = result.costUsd != null ? ` ($${result.costUsd.toFixed(4)})` : '';
    console.log(`  ${result.num.padEnd(8)} ${result.status.padEnd(8)} ${result.detail}${cost}`);
  }
  const totalCost = results.reduce((sum, result) => sum + (result.costUsd ?? 0), 0);
  if (totalCost > 0) console.log(`  total post-pass cost: $${totalCost.toFixed(4)}`);
}

function sizeMb(filePath) {
  return (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
}
