import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDeployedBuildId } from './updateChecker';

describe('getDeployedBuildId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts a successful plain-text build token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('release_2026-08-05', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })));
    await expect(getDeployedBuildId()).resolves.toBe('release_2026-08-05');
  });

  it('rejects an HTML hosting fallback even when its status is 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })));
    await expect(getDeployedBuildId()).resolves.toBeNull();
  });

  it('rejects failed and malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })));
    await expect(getDeployedBuildId()).resolves.toBeNull();
  });
});
