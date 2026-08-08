#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildId, writeBuildId } from './build-id.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let buildId;
try {
  buildId = createBuildId(process.env.NEXT_PUBLIC_BUILD_ID);
  writeBuildId(root, buildId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: root,
  env: { ...process.env, NEXT_PUBLIC_BUILD_ID: buildId },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
