## Septanteminutes.be

Codebase for [septanteminutes.be](https://www.septanteminutes.be), the website for the _"Septante Minutes Avec"_ podcast.

**Stack:** Next.js 15 (Pages Router, `output: "export"`), React 18, TypeScript 5, Framer Motion 12, PWA (Workbox), Firebase Hosting.

---

### Local development

**Prerequisites:** Node 22 (see `.nvmrc`), Yarn 1.x.

```bash
cp .env.example .env      # set EPISODES_COUNT
yarn install
yarn dev                  # http://localhost:3000
```

### Build & deploy

```bash
yarn build                # static export → out/
firebase login            # required if not already authenticated
firebase deploy           # deploy to Firebase Hosting (site: septanteminutesbe)
```

`yarn build` also prepares the YouTube photo-print images. It selects the
guest-focused tile from YouTube's M13 storyboard and stores it at its native
320x180 resolution as both WebP and JPEG, allowing the browser to choose WebP
with a JPEG fallback. This is the same lightweight process on local Macs and the
Ubuntu runners used by GitHub Actions; it does not install Python packages,
download models, or run AI inference.

On hosted runners, a direct YouTube request may omit the storyboard data. When
`STORYBOARD_PROXY_URL` and `STORYBOARD_PROXY_TOKEN` are set, the prebuild retries
through the narrow authenticated Raspberry Pi service described in
[`docs/storyboard-proxy.md`](docs/storyboard-proxy.md). It then preserves the
currently deployed frame from `septanteminutes.be`; if that is unavailable or
invalid, it downloads `maxres2.webp`, falling back to `maxres2.jpg`. A failed
build-time fetch does not block the site export. Set
`VIDEO_THUMBNAILS_REFRESH=1` to regenerate cached images.

The environment-based proxy is deliberately disabled outside GitHub Actions.
Local `yarn build` always uses the direct YouTube/deployed/maxres2 cascade.

### Tests

```bash
yarn test                 # run once
yarn test:watch           # watch mode
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `EPISODES_COUNT` | Total number of published episodes (used at build time) |

See `.env.example` for a template.

### GitHub Actions secrets

The scheduled workflows in `.github/workflows/` need these repository secrets
(Settings → Secrets and variables → Actions). Secrets are write-only — GitHub
never lets you read a value back — so rotating one means minting a new
credential and overwriting the secret; there's no "download the old one" step.
For the three service-account secrets, the value is the **entire key JSON**
Google gives you, braces and newlines included — pasting just the
`private_key` field is the most common way to break these.

| Secret | Used by | Authenticates | Breaks if missing/wrong |
|--------|---------|----------------|--------------------------|
| `FIRESTORE_SERVICE_ACCOUNT` | `update-episodes.yml` | GCP service account key JSON, read by `scripts/export-firestore-episodes.mjs` to export Firestore → `public/js/data.json` | `update_episodes.sh` fails at the export step; `data.json` is never refreshed and no deploy happens |
| `FIREBASE_SERVICE_ACCOUNT` | `deploy-security.yml` | Key JSON exposed as `GOOGLE_APPLICATION_CREDENTIALS` for `firebase deploy --only hosting` | The build completes but the Firebase Hosting deploy step fails; the site is never updated |
| `RSS_TRIGGER_SA` | `fetch-episodes-rss.yml` | Key JSON for a service account granted `roles/cloudfunctions.invoker` on the private `getEpisodesFromRSS` Cloud Function; `scripts/fetch-episodes-rss.sh` mints a short-lived Google identity token from it | The function answers 401/403, the script exits non-zero, and Firestore stays stale until the next successful run |
| `STORYBOARD_PROXY_URL` / `STORYBOARD_PROXY_TOKEN` | `deploy-security.yml` (build step) | Bearer token for the Raspberry Pi storyboard proxy — see [`docs/storyboard-proxy.md`](docs/storyboard-proxy.md) | Not fatal: the build falls back to the deployed frame or `maxres2.webp`/`.jpg`; only affects a fallback path for guest tile images on hosted runners |

### Episode data

`public/js/data.json` is the single source of truth for all episode metadata (titles, guests, dates, audio URLs), and is committed so builds need no network access to Firestore.

Regenerating it is automated. `fetch-episodes-rss.yml` triggers the `getEpisodesFromRSS` Cloud Function (which lives in a separate, non-public project) to sync the podcast feed into Firestore. `update-episodes.yml` then exports Firestore, updates `EPISODES_COUNT`, opens a transcript tracking issue per new episode, and creates a protected PR when the exported content changed. It explicitly runs CI on that commit and merges only after the required build passes, then dispatches `deploy-security.yml` to rebuild and deploy Firebase Hosting.

### Project structure

```
app/          # Route handlers (sitemap.xml, rss.xml)
public/       # Static assets, episode data (data.json), SW
src/
  components/ # UI components (VinylAlbum, Player, Season, …)
  pages/      # Next.js pages (index, faq, episode routes)
  types/      # Shared TypeScript types
  utils/      # Shared utilities (normalizeStr, cdn_img_loader, …)
sw.js         # Workbox service worker source (compiled by next-pwa)
worker/       # Custom service worker hooks compiled by @ducanh2912/next-pwa
```

### Architecture notes

- **Fully static export** — no server-side rendering at runtime; all pages are pre-rendered at build time via `getStaticProps` / `getStaticPaths`.
- **Episode data** lives in `public/js/data.json` and is updated by a separate script on each deploy.
- **Image CDN** — all images go through Cloudinary via the custom loader at `src/utils/cdn_img_loader.js`.
- **PWA** — `sw.js` is compiled by `@ducanh2912/next-pwa` (InjectManifest mode); the service worker is registered automatically.

### License

MIT — see [LICENSE](LICENSE). Note: podcast episodes (audio content) are licensed CC-BY separately; this license covers the website code only.
