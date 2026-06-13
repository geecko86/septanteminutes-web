// scripts/transcribe/download.mjs
//
// Downloads an episode MP3 (following Anchor redirects) into the gitignored
// audio cache. Skips when the cached file already exists.

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AUDIO_CACHE_DIR } from './config.mjs';

/**
 * @param {{ num: string, mp3: string }} episode
 * @returns {Promise<{ path: string, cached: boolean }>}
 */
export async function downloadAudio(episode) {
  const dest = path.join(AUDIO_CACHE_DIR, `${episode.num}.mp3`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { path: dest, cached: true };
  }

  if (!episode.mp3) throw new Error(`Episode ${episode.num} has no mp3 URL`);

  fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

  const res = await fetch(episode.mp3, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Audio download failed for episode ${episode.num}: HTTP ${res.status}`);
  }

  // Stream to a temp file then rename, so an interrupted download never
  // leaves a truncated file that would be mistaken for a valid cache entry.
  const tmp = `${dest}.tmp`;
  try {
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }

  return { path: dest, cached: false };
}
