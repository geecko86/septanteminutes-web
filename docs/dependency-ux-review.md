# Reviewing a major dependency upgrade

Minor and patch bumps arrive as one grouped weekly PR and auto-merge once CI is
green. Majors arrive on their own and never auto-merge — `next`, `react`,
`framer-motion` and friends can build perfectly and still ruin the scene.

Two checks run on those PRs:

| Check | What it proves |
| --- | --- |
| `build` (`ci.yml`) | Tests pass and the static export still builds. |
| `ux-review` (`dependabot-major-review.yml`) | The site still *looks* and *behaves* the same. |

## When it runs

Only on npm majors that can reach the browser. GitHub Actions bumps are out by
ecosystem, and a skip list in the workflow drops majors that never render:
`@types/*`, typecheck and lint (`typescript`, `eslint*`, `@eslint/*`), test
tooling (`vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react`), dev
tooling (`playwright`, `pixelmatch`, `pngjs`, `@next/bundle-analyzer`) and the
offline pipelines (`@anthropic-ai/sdk`, `firebase-admin`).

The CSS and minification pipeline is deliberately **not** skipped — `cssnano`,
`terser-webpack-plugin`, the `*-loader` packages, `webpack` and `sharp` all
shape the emitted output and can move pixels. A grouped PR is reviewed if even
one of its packages falls outside the skip list.

## What the UX review does

It builds the site twice — once from the PR's merge base, once from the bump —
and compares the two static exports with a real browser:

- **Visual** — `/`, `/faq/`, episode 1 and the latest episode, screenshotted at
  1440×900 and on an emulated iPhone 13, then diffed pixel by pixel. Anything
  above 0.15 % of changed pixels is reported with a diff image.
- **Interaction** — six flows driven through the built site: keyboard and wheel
  panning of the home scene, starting playback from the album pile, opening the
  notebook overlay, opening the mobile service sheet, and the post-it link back
  home.

Every flow runs against *both* builds. A flow that already fails on `main` is
reported as a note, not as a regression — only "worked before, broken now"
fails the check.

Results land in the job summary, as a PR comment, and as the `ux-report`
artifact (all screenshots plus diff images, kept 14 days).

## Determinism

Screenshot comparison is only useful if two runs of the same code are
identical. Four things make that true, all in `scripts/ux-check.mjs`:

- `hasMovedHome` is seeded to `3` in `localStorage`, which retires the home
  page's idle swipe animation and the swiper hint. Without it the camera drifts
  between screenshots.
- Every remote image is served as a 2×2 grey PNG. Layout on this site comes
  from CSS (`next/image` `fill`), so geometry is preserved while the CDN drops
  out of the comparison entirely.
- CSS animations and transitions are zeroed out and the context runs with
  `reducedMotion: 'reduce'`.
- Service worker registration is stubbed, so no build serves another build's
  assets.

If a check ever turns flaky, that list is where to look first.

## Running it locally

```sh
yarn build && mv out out-head
git stash                       # or check out main in a worktree
yarn build && mv out out-base
yarn ux-check --head out-head --base out-base
```

The report is written to `ux-report/`. Exit code 1 means a regression.
`--head` alone runs the interaction flows without any visual comparison.

Useful flags: `--threshold 0.5` (percent of changed pixels tolerated),
`--settle 2500` (ms to wait before each screenshot).

## Adding a flow

Flows live in the `FLOWS` array in `scripts/ux-check.mjs`. Assert on something
the production build cannot rename: an element `id`, a `data-testid`, or a DOM
property. **Never assert on a CSS module class name** — `next.config.js` hashes
them to five characters in production builds.
