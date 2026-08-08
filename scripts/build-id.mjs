import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BUILD_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function createBuildId(suppliedBuildId) {
  const buildId = suppliedBuildId?.trim() || `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
  if (!BUILD_ID_PATTERN.test(buildId)) {
    throw new Error('NEXT_PUBLIC_BUILD_ID must be an 8-64 character URL-safe token.');
  }
  return buildId;
}

export function writeBuildId(root, buildId) {
  const apiDir = path.join(root, 'public', 'api');
  mkdirSync(apiDir, { recursive: true });
  writeFileSync(path.join(apiDir, 'buildId.txt'), buildId, 'utf8');
}
