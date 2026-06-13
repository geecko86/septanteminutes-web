// scripts/transcribe/manifest.mjs
//
// Rebuilds public/transcripts/manifest.json from the *.vtt directory listing.
// The manifest is the single source of truth for the RSS route and the
// frontend's availability check.

import fs from 'node:fs';
import path from 'node:path';
import { TRANSCRIPTS_DIR, SCHEMA_VERSION } from './config.mjs';

/**
 * @returns {{ version: number, episodes: string[] }} the manifest written to disk
 */
export function rebuildManifest() {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

  const episodes = fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((file) => file.endsWith('.vtt'))
    .map((file) => file.slice(0, -'.vtt'.length))
    .filter((num) => /^\d+$/.test(num))
    .sort((a, b) => Number(a) - Number(b));

  const manifest = { version: SCHEMA_VERSION, episodes };
  fs.writeFileSync(path.join(TRANSCRIPTS_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
