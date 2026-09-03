import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { BUILD_ID_PATTERN, createBuildId, writeBuildId } from './build-id.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

async function runWorker(relativePath, message) {
  const requests = [];
  const messages = [];
  const context = {
    console,
    encodeURIComponent,
    postMessage: value => messages.push(value),
    fetch: vi.fn(async url => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          episodes: {
            1: { num: '1', season: '1' },
            2: { num: '2', season: '1' },
          },
        }),
      };
    }),
  };
  vm.createContext(context);
  vm.runInContext(read(relativePath), context);
  context.onmessage({ data: message });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { requests, messages };
}

describe('performance request regressions', () => {
  it('writes the same valid build ID that is supplied to compilation', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'septante-build-id-'));
    const buildId = createBuildId('release_2026-08-05');
    writeBuildId(tempRoot, buildId);

    expect(BUILD_ID_PATTERN.test(buildId)).toBe(true);
    expect(readFileSync(path.join(tempRoot, 'public/api/buildId.txt'), 'utf8')).toBe(buildId);
  });

  it.each(['public/js/seasonFetcher.js', 'public/js/vinylsFetcher.js'])(
    '%s makes one direct versioned data request',
    async workerPath => {
      const result = await runWorker(workerPath, {
        buildId: 'release_2026-08-05',
        cachedSeasons: '[]',
      });
      expect(result.requests).toEqual(['/js/data.json?buildId=release_2026-08-05']);
    }
  );

  it('uses cached seasons only as a fallback before replacing them from the network', async () => {
    const cachedSeasons = Array.from({ length: 4 }, (_, index) => ({
      name: `cached-${index}`,
      episodes: [],
    }));
    const result = await runWorker('public/js/seasonFetcher.js', {
      buildId: 'release_2026-08-05',
      cachedSeasons: JSON.stringify(cachedSeasons),
    });

    expect(result.messages[0]).toEqual({ source: 'cache', seasons: cachedSeasons });
    expect(result.messages[1]).toEqual({
      source: 'network',
      seasons: [{ name: '1', episodes: [
        { num: '1', season: '1' },
        { num: '2', season: '1' },
      ] }],
    });
  });

  it('recovers from malformed cached seasons without suppressing the network request', async () => {
    const result = await runWorker('public/js/seasonFetcher.js', {
      buildId: 'release_2026-08-05',
      cachedSeasons: '<corrupt cache>',
    });

    expect(result.requests).toEqual(['/js/data.json?buildId=release_2026-08-05']);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].source).toBe('network');
  });

  it('versions the season worker and reloads when a new build is detected', () => {
    const home = read('src/pages/index.tsx');
    const app = read('src/pages/_app.tsx');
    const updateChecker = read('src/utils/updateChecker.ts');
    expect(home).toContain('new Worker(`/js/seasonFetcher.js?buildId=${encodeURIComponent(BUILD_ID)}`)');
    expect(home).not.toMatch(/\[ready, onTheMove, router\.asPath, seasons\.length\]/);
    expect(app).toContain("updateUrl.searchParams.set('_build', buildId)");
    expect(app).toContain('window.location.replace(updateUrl.toString())');
    expect(updateChecker).toContain('/api/buildId.txt?compiled=${encodeURIComponent(BUILD_ID)}');
    expect(updateChecker).toContain('navigator.serviceWorker.getRegistrations()');
    expect(updateChecker).toContain('window.caches.delete(cacheName)');
    expect(updateChecker).toContain('alreadyAttempted');
  });

  it('revalidates HTML and public workers while keeping hashed chunks immutable', () => {
    const firebase = JSON.parse(read('firebase.json'));
    const cacheControl = Object.fromEntries(firebase.hosting.headers
      .filter(rule => rule.headers.some(header => header.key === 'Cache-Control'))
      .map(rule => [rule.source, rule.headers.find(header => header.key === 'Cache-Control').value]));

    expect(cacheControl['**/']).toContain('max-age=0');
    expect(cacheControl['**/*.html']).toContain('max-age=0');
    expect(cacheControl['/js/*.js']).toContain('max-age=0');
    expect(cacheControl['/sw.js']).toContain('no-store');
    expect(cacheControl['/_next/static/**/*.js']).toContain('immutable');
  });

  it('publishes episode exports through a CI-gated PR before deployment', () => {
    const script = read('update_episodes.sh');
    const updater = read('.github/workflows/update-episodes.yml');
    const deployer = read('.github/workflows/deploy-security.yml');

    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('git push origin "HEAD:refs/heads/$update_branch"');
    expect(script).toContain('gh pr merge --auto --squash --delete-branch');
    expect(script).not.toContain('firebase deploy');
    expect(updater).toContain('actions/create-github-app-token@v2');
    expect(updater).toContain('EPISODE_UPDATE_BRANCH: automation/episode-update-');
    expect(deployer).toContain("- 'public/js/data.json'");
  });

  it('selects explicit Brussels DST schedules without using delayed start hours', () => {
    const rss = read('.github/workflows/fetch-episodes-rss.yml');
    const updater = read('.github/workflows/update-episodes.yml');

    expect(rss).toContain("cron: '20 1,4,7,10,13,16,19,22");
    expect(rss).toContain("cron: '20 2,5,8,11,14,17,20,23");
    expect(updater).toContain("cron: '30 1,4,7,10,13,16,19,22");
    expect(updater).toContain("cron: '30 2,5,8,11,14,17,20,23");
    expect(rss).toContain('SCHEDULE: ${{ github.event.schedule }}');
    expect(updater).toContain('SCHEDULE: ${{ github.event.schedule }}');
    expect(rss).not.toContain("date '+%m %H'");
    expect(updater).not.toContain("date '+%m %H'");
  });

  it('disables route prefetch for initial homepage albums and the episode home link', () => {
    expect(read('src/components/HomeAlbum/index.js')).toContain('prefetch={false}');
    expect(read('src/pages/[episodeNum]/index.tsx')).toMatch(/link={`\/#\$\{selectedEpisode \+ 1\}`}\s+prefetch={false}/);
    expect(read('src/pages/[episodeNum]/index.tsx')).toContain("{ pathname: router.pathname, query: { episodeNum } }");
  });

  it('keeps device-specific priority and existing loading decisions explicit', () => {
    const home = read('src/pages/index.tsx');
    expect(home).toContain('fetchPriority={!isMobileDevice && i === 0 ? "high" : undefined}');
    expect(home).toContain('fetchPriority={isMobileDevice &&');
    expect(home).toContain('loading={isMobileDevice ? "lazy" : "eager"}');
    expect(home).toContain('loading="lazy" quality={50}');
    expect(read('src/components/HomeAlbum/index.js')).toContain('loading="eager"');
    expect(read('src/components/RecordPlayer/index.js')).toContain('fetchPriority="high"');
  });

  it('keeps Google Fonts external and removes the stale Caveat font preload', () => {
    const document = read('src/pages/_document.js');
    expect(document).toContain('fonts.googleapis.com/css2?family=Caveat');
    expect(document).toContain('rel="stylesheet"');
    expect(document).not.toContain('/caveat/v18/');
    expect(read('src/pages/_document.js')).not.toMatch(/href="\/fonts\/.*Caveat/i);
  });

  it('gates both routes on the finite initial-scene contract instead of a DOM priority snapshot', () => {
    const home = read('src/pages/index.tsx');
    const episode = read('src/pages/[episodeNum]/index.tsx');
    expect(home).toContain('waitForInitialScene');
    expect(home).toContain('sceneModulesReady');
    expect(episode).toContain('waitForInitialScene');
    expect(episode).toContain('sceneModulesReady');
    expect(episode).toContain('Math.max(0, Math.min(requested, vinyls.length - 1))');
    expect(episode).not.toContain("querySelectorAll('img[fetchpriority=\"high\"]')");
    expect(read('src/utils/initialSceneReady.ts')).toContain('document.fonts.ready');
  });

  it('keeps the restored compact Plant2 blur and the original chair rendition sizes', () => {
    const plant = read('src/framer/assets/Plant2.jsx');
    const encodedBlur = plant.match(/base64,([A-Za-z0-9+/=]+)"/)?.[1] || '';
    expect(encodedBlur.length).toBeGreaterThan(0);
    expect(encodedBlur.length).toBeLessThan(500);
    const chair = read('src/framer/assets/Chair.jsx');
    expect(chair).toContain('mobile ? "25vh" : "50vh"');
    expect(chair).not.toContain('80vmax');
  });
});
