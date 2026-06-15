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
import { TRANSCRIPTS_DIR, AUDIO_CACHE_DIR, ASR_CACHE_DIR, SCHEMA_VERSION } from './transcribe/config.mjs';
import { loadEpisodes, resolveSelection, hasTranscript } from './transcribe/episodes.mjs';
import { downloadAudio } from './transcribe/download.mjs';
import { transcribeAudio } from './transcribe/asr.mjs';
import { buildSegments, mergePhantomSpeakers } from './transcribe/segments.mjs';
import { detectBackend, getResolvedModel } from './transcribe/llm.mjs';
import { postProcess } from './transcribe/postprocess.mjs';
import { transcriptToVtt } from './transcribe/vtt.mjs';
import { rebuildManifest } from './transcribe/manifest.mjs';

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
  --concurrency <n>  correction chunks processed in parallel (default 1, max 8)
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
      concurrency: { type: 'string', default: '1' },
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

  const flags = {
    force: values.force,
    redoClaude: values['redo-claude'],
    asrOnly: values['asr-only'],
    dryRun: values['dry-run'],
    concurrency: Number(values.concurrency),
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

  const results = [];
  for (const episode of episodes) {
    try {
      results.push(await processEpisode(episode, flags));
    } catch (error) {
      console.error(`[${episode.num}] failed: ${error.message}`);
      results.push({ num: episode.num, status: 'failed', detail: error.message });
    }
  }

  if (!flags.dryRun && !flags.asrOnly) {
    const manifest = rebuildManifest();
    console.log(`manifest: ${manifest.episodes.length} episode(s) [${manifest.episodes.join(', ')}]`);
  }

  printSummary(results);

  if (results.some((result) => result.status === 'failed')) {
    process.exitCode = 1;
  }
}

async function processEpisode(episode, flags) {
  const { num } = episode;
  const log = console.log;
  const jsonPath = path.join(TRANSCRIPTS_DIR, `${num}.json`);
  const vttPath = path.join(TRANSCRIPTS_DIR, `${num}.vtt`);
  // Same staleness rule as the --missing filter: outdated/synthetic versions
  // (e.g. the version-0 dev fixture) are regenerated, not skipped.
  const outputsExist = hasTranscript(num);

  if (outputsExist && !flags.force && !flags.redoClaude && !flags.asrOnly) {
    log(`[${num}] output: exists (skip — use --force or --redo-claude to regenerate)`);
    return { num, status: 'skipped', detail: 'output exists' };
  }

  if (flags.dryRun) return dryRunEpisode(episode, flags);

  // 1. Audio (cache always reused — re-downloading 70 MB serves nothing).
  const audio = await downloadAudio(episode);
  log(`[${num}] audio: ${audio.cached ? 'cached (skip)' : `downloaded (${sizeMb(audio.path)} MB)`}`);

  // 2. ASR (--force re-pays ElevenLabs; --redo-claude reuses the cache).
  const asr = await transcribeAudio(episode, audio.path, { force: flags.force, log });
  log(`[${num}] asr: ${asr.cached ? 'cached (skip)' : `transcribed with ${asr.modelId}`}`);

  if (flags.asrOnly) {
    log(`[${num}] post: skipped (--asr-only)`);
    return { num, status: 'ok', detail: 'asr cached' };
  }

  // 3. Deterministic segmentation (phantom speakers merged first).
  const words = mergePhantomSpeakers(asr.response.words ?? []);
  const segments = buildSegments(words);
  log(`[${num}] segments: ${segments.length}`);

  // 4. Claude post-pass (backend detected lazily, logged once per run).
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

  // 5. Outputs. The CLI 'opus' alias tracks the latest Opus, so record the
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
    language: 'fr',
    engine: `elevenlabs/${asr.modelId}`,
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

/** Prints the planned stages without touching the network, LLM or disk. */
function dryRunEpisode(episode, flags) {
  const { num } = episode;
  const audioCached = fs.existsSync(path.join(AUDIO_CACHE_DIR, `${num}.mp3`));
  const asrCached = fs.existsSync(path.join(ASR_CACHE_DIR, `${num}.json`));

  console.log(`[${num}] audio: ${audioCached ? 'cached (skip)' : 'would download mp3'}`);
  console.log(
    `[${num}] asr: ${asrCached && !flags.force ? 'cached (skip)' : 'would call ElevenLabs Scribe'}`,
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
