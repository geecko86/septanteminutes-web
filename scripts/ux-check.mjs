#!/usr/bin/env node
/**
 * UX regression check for dependency upgrades.
 *
 * Builds are compared as static exports: the same routes are screenshotted on
 * desktop and mobile in both builds and diffed pixel by pixel, then a set of
 * interaction flows is driven with a real browser in both builds. A flow that
 * works in the baseline but breaks in the candidate is a regression; a flow
 * broken in both means the check itself is broken and is reported just as loudly.
 *
 * Usage:
 *   node scripts/ux-check.mjs --head out --base out-base [--report ux-report]
 *   node scripts/ux-check.mjs --head out            # smoke flows only
 *
 * Exit code 1 = regression found. Everything else is reported, not fatal.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  // Two builds of the same source diff to exactly 0 changed pixels, so the
  // tolerance only has to absorb antialiasing jitter — 0.15 % was lax enough
  // to let a real text-metric shift through on the desktop episode page.
  const out = { report: 'ux-report', threshold: 0.02, settle: 1500 };
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inline] = argv[i].split('=');
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = inline ?? argv[++i];
    out[name] = name === 'threshold' || name === 'settle' ? Number(value) : value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.head) {
  console.error('Missing --head <static export dir>');
  process.exit(2);
}

const REPORT = path.resolve(ROOT, args.report);

// ------------------------------------------------------------------ routes

// Read the episode count the build was generated with so the newest episode —
// the one with the most recent layout work — is always part of the sweep.
function episodeCount() {
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const match = env.match(/EPISODES_COUNT=(\d+)/);
    if (match) return Number(match[1]);
  } catch { /* fall through */ }
  return 1;
}

// Interview directories are named `<episodeNumber>-<slug>` and the slug isn't
// derivable from EPISODES_COUNT alone, so resolve it from the build itself —
// a route that vanishes (episode renumbered, dir missing) degrades to "skip"
// rather than a hardcoded slug going stale and crashing the sweep.
function interviewLatestRoute(dir) {
  const parent = path.join(dir, 'podcast', 'interview');
  const prefix = `${episodeCount()}-`;
  const match = fs.readdirSync(parent, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.startsWith(prefix)
  );
  return match ? `/podcast/interview/${match.name}/` : null;
}

const CANDIDATE_ROUTES = [
  { name: 'home', url: '/' },
  // Ordinary document flow — the only route where a full-page capture is
  // both meaningful (real below-the-fold content) and stable.
  { name: 'faq', url: '/faq/', fullPage: true },
  { name: 'episode-first', url: '/1/' },
  { name: 'episode-latest', url: `/${episodeCount()}/` },
  { name: 'interview-latest', resolve: interviewLatestRoute },
];

function routesFor(dir) {
  return CANDIDATE_ROUTES.flatMap((route) => {
    if (route.resolve) {
      let url;
      try {
        url = route.resolve(dir);
      } catch {
        return [];
      }
      return url ? [{ ...route, url }] : [];
    }
    return route.url === '/' ||
      fs.existsSync(path.join(dir, route.url.replace(/^\/|\/$/g, ''), 'index.html'))
      ? [route]
      : [];
  });
}

const VIEWPORTS = [
  { name: 'desktop', options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile', options: devices['iPhone 13'] },
];

// ----------------------------------------------------------- static server

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.vtt': 'text/vtt',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serve(dir) {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    // next.config.js writes public/api/buildId.txt during the build, so a fresh
    // checkout exports without it — and Firebase answers the miss with the SPA
    // fallback rather than a 404. A hard 404 here makes the vinyls worker throw,
    // leaving the episode pages with no data and the album flows dead on
    // vinyls[selectedEpisode]. Serve a stand-in so CI matches production.
    if (clean === '/api/buildId.txt' && !fs.existsSync(path.join(dir, 'api/buildId.txt'))) {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ux-check');
      return;
    }
    let file = path.join(dir, clean);
    // trailingSlash: true — every route is a directory holding an index.html.
    if (!path.extname(file)) file = path.join(file, 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

// ------------------------------------------------------- browser determinism

// A 2x2 flat #9a9a9a PNG standing in for every remote image. Geometry on this
// site is CSS-driven (next/image fill), so substituting the bytes keeps the
// layout identical while removing the CDN from the comparison entirely.
// Flat and neutral on purpose: a coloured placeholder scales up into invented
// gradients that swamp the scene and make the diff artifact unreadable.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR42mOYBQYMEAoAMpYHOU6YhpUAAAAASUVORK5CYII=',
  'base64'
);

const FREEZE_CSS = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
}`;

const INIT_SCRIPT = () => {
  // The home page nudges first-time visitors with an idle swipe animation and
  // a swiper hint. Three recorded moves retires both, which is what makes the
  // scene stand still long enough to screenshot.
  try {
    localStorage.setItem('hasMovedHome', '3');
    localStorage.setItem('hasClickedPlay', '3');
    localStorage.setItem('hasClickedNotebook', '1');
  } catch { /* storage unavailable */ }
  // The service worker would serve a previous build's assets across contexts.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = () => new Promise(() => {});
  }
};

async function newPage(browser, viewport, origin) {
  const context = await browser.newContext({
    ...viewport.options,
    reducedMotion: 'reduce',
    baseURL: origin,
  });
  await context.addInitScript(INIT_SCRIPT);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (route.request().resourceType() === 'image') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PLACEHOLDER_PNG });
    }
    return route.abort();
  });
  const page = await context.newPage();
  return { context, page };
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  // The episode page holds its whole scene at opacity 0.001 until the priority
  // images resolve (up to PRIORITY_IMAGE_TIMEOUT_MS). Screenshotting on a fixed
  // delay caught the curtain instead of the room — every episode looked alike.
  await page
    .waitForFunction(
      () => {
        const scene = document.querySelector('[data-testid="episode-scene"]');
        return !scene || Number(getComputedStyle(scene).opacity) > 0.9;
      },
      undefined,
      { timeout: 10000 }
    )
    .catch(() => console.warn('  scene never became visible — capturing anyway'));
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
  await page.waitForTimeout(args.settle);
}

// ---------------------------------------------------------------- capturing

async function capture(browser, origin, label) {
  const shots = [];
  for (const viewport of VIEWPORTS) {
    const { context, page } = await newPage(browser, viewport, origin);
    for (const route of routesFor(path.resolve(ROOT, label === 'head' ? args.head : args.base))) {
      const file = path.join(REPORT, label, `${viewport.name}--${route.name}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.goto(route.url, { waitUntil: 'domcontentloaded' });
      await settle(page);
      await page.screenshot({ path: file, fullPage: Boolean(route.fullPage) });
      shots.push({ viewport: viewport.name, route: route.name, file });
    }
    await context.close();
  }
  return shots;
}

function compare(baseShots, headShots) {
  const results = [];
  for (const head of headShots) {
    const base = baseShots.find((s) => s.viewport === head.viewport && s.route === head.route);
    if (!base) {
      results.push({ ...head, status: 'new', ratio: 0 });
      continue;
    }
    const a = PNG.sync.read(fs.readFileSync(base.file));
    const b = PNG.sync.read(fs.readFileSync(head.file));
    if (a.width !== b.width || a.height !== b.height) {
      results.push({ ...head, status: 'size-changed', ratio: 100 });
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
    const ratio = (changed / (a.width * a.height)) * 100;
    const diffFile = path.join(REPORT, 'diff', `${head.viewport}--${head.route}.png`);
    if (ratio > args.threshold) {
      fs.mkdirSync(path.dirname(diffFile), { recursive: true });
      fs.writeFileSync(diffFile, PNG.sync.write(diff));
    }
    results.push({
      ...head,
      status: ratio > args.threshold ? 'changed' : 'ok',
      ratio,
      diffFile: ratio > args.threshold ? diffFile : undefined,
    });
  }
  return results;
}

// ------------------------------------------------------------- smoke flows

// Each flow drives the real UI and asserts on something the CSS-module hash
// cannot rename: an element id, a data-testid, or a DOM property.
const FLOWS = [
  {
    name: 'home-keyboard-pans-the-scene',
    viewport: 'desktop',
    async run(page) {
      await page.goto('/');
      await settle(page);
      const before = await page.evaluate(() => getComputedStyle(document.getElementById('home')).transform);
      await page.locator('#home').focus();
      for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => getComputedStyle(document.getElementById('home')).transform);
      return { ok: before !== after, detail: `transform ${before} -> ${after}` };
    },
  },
  {
    name: 'home-wheel-pans-the-scene',
    viewport: 'desktop',
    async run(page) {
      await page.goto('/');
      await settle(page);
      const before = await page.evaluate(() => getComputedStyle(document.getElementById('home')).transform);
      await page.mouse.move(700, 450);
      for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, 400);
      await page.waitForTimeout(600);
      const after = await page.evaluate(() => getComputedStyle(document.getElementById('home')).transform);
      return { ok: before !== after, detail: `transform ${before} -> ${after}` };
    },
  },
  {
    name: 'episode-albums-start-playback',
    viewport: 'desktop',
    async run(page) {
      await page.goto(`/${episodeCount()}/`);
      await settle(page);
      await page.locator('[data-testid="episode-albums"]').click();
      await page.waitForTimeout(800);
      // The Audio object never enters the DOM, and the mp3 host is blocked
      // here, so the observable is the floating player revealing itself and
      // naming the episode it picked up.
      const state = await page.evaluate(() => {
        const controls = document.getElementById('floating-playback-controls');
        return {
          visible: controls ? getComputedStyle(controls).visibility : 'missing',
          text: controls?.innerText.replace(/\s+/g, ' ').trim() || '',
        };
      });
      return {
        ok: state.visible === 'visible' && /episode\s*\d+/i.test(state.text),
        detail: `controls=${state.visible} "${state.text.slice(0, 60)}"`,
      };
    },
  },
  {
    name: 'episode-notebook-opens',
    viewport: 'desktop',
    async run(page) {
      await page.goto(`/${episodeCount()}/`);
      await settle(page);
      await page.locator('[data-testid="episode-notebook"]').click();
      // The overlay is always mounted and pre-rendered; only its opacity says
      // whether the notebook actually opened.
      await page.waitForFunction(
        () => Number(getComputedStyle(document.querySelector('[data-testid="notebook-overlay"]')).opacity) > 0.9,
        undefined,
        { timeout: 5000 }
      );
      const text = (await page.locator('[data-testid="notebook-overlay"]').innerText()).trim();
      return { ok: text.length > 0, detail: `overlay opened, ${text.length} chars of copy` };
    },
  },
  {
    name: 'episode-service-sheet-opens',
    viewport: 'mobile',
    async run(page) {
      await page.goto(`/${episodeCount()}/`);
      await settle(page);
      await page.locator('[data-testid="episode-albums"]').tap();
      const sheet = page.locator('[data-testid="service-sheet"]');
      await sheet.waitFor({ state: 'visible', timeout: 5000 });
      const box = await sheet.boundingBox();
      return { ok: !!box && box.height > 50, detail: `sheet height ${box?.height ?? 0}px` };
    },
  },
  {
    name: 'episode-back-to-home',
    viewport: 'desktop',
    async run(page) {
      await page.goto(`/${episodeCount()}/`);
      await settle(page);
      await page.locator('a[href^="/#"]').first().click();
      await page.waitForURL(/\/(#\d+)?$/, { timeout: 5000 });
      await page.waitForSelector('#home', { timeout: 5000 });
      return { ok: true, detail: page.url() };
    },
  },
];

async function runFlows(browser, origin, label) {
  const results = [];
  for (const flow of FLOWS) {
    const viewport = VIEWPORTS.find((v) => v.name === flow.viewport);
    const { context, page } = await newPage(browser, viewport, origin);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const outcome = await flow.run(page);
      results.push({ name: flow.name, viewport: flow.viewport, ...outcome, errors });
    } catch (error) {
      results.push({
        name: flow.name,
        viewport: flow.viewport,
        ok: false,
        detail: error.message.split('\n')[0],
        errors,
      });
      await page
        .screenshot({ path: path.join(REPORT, 'failures', `${label}--${flow.name}.png`) })
        .catch(() => {});
    }
    await context.close();
  }
  return results;
}

// -------------------------------------------------------------------- report

function renderSummary({ visual, flows, hasBase }) {
  const lines = ['## UX check', ''];

  const changed = visual.filter((v) => v.status !== 'ok');
  if (!hasBase) {
    lines.push('_No baseline build supplied — visual diff skipped._', '');
  } else if (changed.length === 0) {
    lines.push(`✅ **Visual** — ${visual.length} screenshots identical to the baseline (desktop + mobile).`, '');
  } else {
    lines.push(`⚠️ **Visual** — ${changed.length} of ${visual.length} screenshots changed:`, '');
    lines.push('| Route | Viewport | Changed pixels |', '| --- | --- | --- |');
    for (const item of changed) {
      lines.push(`| \`${item.route}\` | ${item.viewport} | ${item.ratio.toFixed(2)}% ${item.status === 'size-changed' ? '(page height changed)' : ''} |`);
    }
    lines.push('', '_Diff images are in the `ux-report` artifact._', '');
  }

  const broken = flows.filter((f) => f.regression);
  const preexisting = flows.filter((f) => !f.headOk && !f.baseOk);
  if (broken.length === 0) {
    lines.push(`✅ **Interaction** — ${flows.filter((f) => f.headOk).length}/${flows.length} flows pass.`, '');
  } else {
    lines.push(`❌ **Interaction** — ${broken.length} flow(s) worked before this bump and fail now:`, '');
    for (const flow of broken) lines.push(`- \`${flow.name}\` (${flow.viewport}) — ${flow.detail}`);
    lines.push('');
  }
  if (preexisting.length > 0) {
    lines.push(`🔴 **Check is broken** — ${preexisting.length} flow(s) fail on the base branch too, not just this PR. The harness is not protecting these flows right now and they need repair:`, '');
    for (const flow of preexisting) lines.push(`- \`${flow.name}\` (${flow.viewport}) — ${flow.detail}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------- main

async function main() {
  fs.rmSync(REPORT, { recursive: true, force: true });
  fs.mkdirSync(REPORT, { recursive: true });

  const hasBase = Boolean(args.base);
  const headDir = path.resolve(ROOT, args.head);
  const baseDir = hasBase ? path.resolve(ROOT, args.base) : null;

  const head = await serve(headDir);
  const base = hasBase ? await serve(baseDir) : null;
  const browser = await chromium.launch();

  const headShots = await capture(browser, head.origin, 'head');
  const baseShots = hasBase ? await capture(browser, base.origin, 'base') : [];
  const visual = hasBase ? compare(baseShots, headShots) : [];

  const headFlows = await runFlows(browser, head.origin, 'head');
  const baseFlows = hasBase ? await runFlows(browser, base.origin, 'base') : [];

  const flows = headFlows.map((flow) => {
    const before = baseFlows.find((f) => f.name === flow.name);
    const baseOk = hasBase ? Boolean(before?.ok) : true;
    return {
      name: flow.name,
      viewport: flow.viewport,
      headOk: flow.ok,
      baseOk,
      regression: baseOk && !flow.ok,
      detail: flow.detail,
      errors: flow.errors,
    };
  });

  await browser.close();
  head.server.close();
  base?.server.close();

  const regressions = [
    ...visual.filter((v) => v.status !== 'ok'),
    ...flows.filter((f) => f.regression || (!f.headOk && !f.baseOk)),
  ];
  const summary = renderSummary({ visual, flows, hasBase });

  fs.writeFileSync(path.join(REPORT, 'summary.md'), summary);
  fs.writeFileSync(
    path.join(REPORT, 'summary.json'),
    JSON.stringify({ visual, flows, regressions: regressions.length }, null, 2)
  );

  console.log(summary);
  process.exit(regressions.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
