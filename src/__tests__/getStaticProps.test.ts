// Tests for getStaticPaths and getStaticProps in both episode page routes.
//
// These functions are "server-side" helpers — they run at build time to figure out
// which URLs to pre-build and what data to inject into each page. Think of them
// like a librarian who prepares index cards (paths) and fills in the book content
// (props) before the library opens.
//
// We test them in plain Node (no jsdom needed) because they just read JSON and
// return objects — no browser APIs involved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// We mock heavy UI imports that these page files drag in transitively.
// Without mocking, Vitest would try to process CSS modules, SVGs, and browser-
// only APIs — all of which fail in Node. The mocks tell Vitest "pretend those
// modules exist and export empty stubs; we don't care about them for these tests."
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => 'div' }),
  useScroll: () => ({ scrollYProgress: { get: () => 0 }, scrollY: {} }),
  animate: () => Promise.resolve(),
  useMotionValueEvent: () => {},
  usePresence: () => [true, () => {}],
}));
vi.mock('usehooks-ts', () => ({ useEventListener: () => {} }));
vi.mock('scroll-snap', () => ({ default: () => ({ bind: () => {}, unbind: () => {} }) }));
vi.mock('next-seo', () => ({ NextSeo: () => null }));
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, replace: () => {}, beforePopState: () => {}, asPath: '/', pathname: '/' }) }));
vi.mock('next/link', () => ({ default: ({ children }: any) => children }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/head', () => ({ default: ({ children }: any) => children }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('../framer/ImageWrapper.js', () => ({ Pen: () => null, Headphones: () => null, Chair: () => null }));
vi.mock('../framer/Notebook-Large-POCp.js', () => ({ default: () => null }));
vi.mock('../framer/Imaged-Post-It-1vlf.js', () => ({ default: () => null }));
vi.mock('../components/RecordPlayer/index.js', () => ({ default: () => null }));
vi.mock('../components/VinylAlbum', () => ({ default: () => null, ShadowAlbum: () => null }));
vi.mock('../components/NotebookOverlay/index.js', () => ({ default: () => ({ notebookOverlayComponent: null, referenceProps: {}, refs: {} }) }));
vi.mock('../components/MaterialSpinningLoader/index.js', () => ({ default: () => null }));
vi.mock('../utils/PlayerContext', () => ({
  hackAutoplay: () => Promise.resolve(),
  usePlayback: () => ({ setPlaying: () => {}, setPlayingEpisode: () => {}, isPlaying: false, playingEpisode: undefined, autoplay: undefined, status: 0, audio: undefined }),
}));
vi.mock('react-spring-bottom-sheet', () => ({ BottomSheet: () => null }));

// ---------------------------------------------------------------------------
// Now we can safely import the real getStaticPaths / getStaticProps functions.
// ---------------------------------------------------------------------------
import { getStaticPaths, getStaticProps } from '../pages/[episodeNum]/index';
import {
  getStaticPaths as getGuestPaths,
  getStaticProps as getGuestProps,
} from '../pages/podcast/interview/[episodeName]/index';

// ---------------------------------------------------------------------------
// [episodeNum] route
// ---------------------------------------------------------------------------
describe('[episodeNum] getStaticPaths', () => {
  const originalCount = process.env.EPISODES_COUNT;

  beforeEach(() => {
    // Pretend the podcast has 3 episodes so tests run fast and don't depend on
    // the real episode count changing over time.
    process.env.EPISODES_COUNT = '3';
  });

  afterEach(() => {
    process.env.EPISODES_COUNT = originalCount;
  });

  it('returns exactly EPISODES_COUNT paths', async () => {
    const result = await getStaticPaths({} as any);
    expect(result.paths).toHaveLength(3);
  });

  it('each path has the right shape { params: { episodeNum: string } }', async () => {
    const result = await getStaticPaths({} as any);
    result.paths.forEach((path: any) => {
      expect(path).toHaveProperty('params');
      expect(path.params).toHaveProperty('episodeNum');
      expect(typeof path.params.episodeNum).toBe('string');
    });
  });

  it('path params are "1", "2", "3" (1-based, string-typed)', async () => {
    const result = await getStaticPaths({} as any);
    const nums = (result.paths as any[]).map((p: any) => p.params.episodeNum);
    expect(nums).toEqual(['1', '2', '3']);
  });

  it('fallback is false (unknown URLs must 404)', async () => {
    const result = await getStaticPaths({} as any);
    expect(result.fallback).toBe(false);
  });
});

describe('[episodeNum] getStaticProps', () => {
  it('returns { props: { episode } } for a known episode number', async () => {
    // Episode 1 is always the first entry in data.json — safe to use as a fixture.
    const result = await getStaticProps({ params: { episodeNum: '1' } } as any);
    expect(result).toHaveProperty('props');
    expect((result as any).props).toHaveProperty('episode');
  });

  it('episode has descText set (HTML stripped, ends with ellipsis)', async () => {
    const result = await getStaticProps({ params: { episodeNum: '1' } } as any);
    const { episode } = (result as any).props;

    // descText should exist and be a non-empty string.
    expect(typeof episode.descText).toBe('string');
    expect(episode.descText.length).toBeGreaterThan(0);

    // descText must not contain any HTML tags — they should have been stripped.
    expect(episode.descText).not.toMatch(/<[^>]+>/);

    // The description is truncated and ends with the ellipsis character.
    expect(episode.descText.endsWith('…')).toBe(true);
  });

  it('descText is at most 199 characters before the ellipsis', async () => {
    const result = await getStaticProps({ params: { episodeNum: '1' } } as any);
    const { descText } = (result as any).props.episode;
    // The slice is 198 chars + "…" = 199 total.
    expect(descText.length).toBeLessThanOrEqual(199);
  });
});

// ---------------------------------------------------------------------------
// [episodeName] (guest slug) route
// ---------------------------------------------------------------------------
describe('[episodeName] getStaticPaths', () => {
  const originalCount = process.env.EPISODES_COUNT;

  beforeEach(() => {
    process.env.EPISODES_COUNT = '3';
  });

  afterEach(() => {
    process.env.EPISODES_COUNT = originalCount;
  });

  it('returns exactly EPISODES_COUNT paths', async () => {
    const result = await getGuestPaths({} as any);
    expect(result.paths).toHaveLength(3);
  });

  it('each path has params.episodeName in the format "num-normalized-guest-name"', async () => {
    const result = await getGuestPaths({} as any);
    (result.paths as any[]).forEach((path: any) => {
      const slug: string = path.params.episodeName;
      // Must start with the episode number followed by a hyphen.
      expect(slug).toMatch(/^\d+-/);
      // Must contain only lowercase letters, digits, and hyphens (normalized).
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });
  });

  it('first path slug starts with "1-" and contains the guest name from episode 1', async () => {
    // Episode 1 guest is "Alexander De Croo" → normalised → "alexander-de-croo"
    const result = await getGuestPaths({} as any);
    const firstSlug: string = (result.paths as any[])[0].params.episodeName;
    expect(firstSlug).toMatch(/^1-/);
    // The slug should contain at least part of the normalised name — no uppercase,
    // no special characters, only hyphens as separators.
    expect(firstSlug).not.toMatch(/[A-Z]/);
  });
});

describe('[episodeName] getStaticProps', () => {
  it('resolves episode data from the slug prefix (episode number)', async () => {
    const result = await getGuestProps({
      params: { episodeName: '1-alexander-de-croo' },
    } as any);
    const { episode, episodeNum } = (result as any).props;

    expect(episode).toBeDefined();
    expect(episodeNum).toBe('1');
  });

  it('episode descText is set, has no HTML, and ends with ellipsis', async () => {
    const result = await getGuestProps({
      params: { episodeName: '2-interface3' },
    } as any);
    const { descText } = (result as any).props.episode;

    expect(typeof descText).toBe('string');
    expect(descText.length).toBeGreaterThan(0);
    expect(descText).not.toMatch(/<[^>]+>/);
    expect(descText.endsWith('…')).toBe(true);
  });
});
