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
320x180 resolution. This is the same lightweight process on local Macs and the
Ubuntu runners used by GitHub Actions; it does not install Python packages,
download models, or run AI inference.

If the storyboard or crop cannot be obtained, the prebuild downloads
`maxres2.webp`, falling back to `maxres2.jpg`. A failed build-time fetch does
not block the site export; the lazy-loaded photo retries those same maxres2
URLs in the browser. Set `VIDEO_THUMBNAILS_REFRESH=1` to regenerate cached
images.

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

### Episode data

`public/js/data.json` is the single source of truth for all episode metadata (titles, guests, dates, audio URLs). It must be regenerated and committed before each deploy to reflect newly published episodes. The regeneration script is **not currently in this repository** — updating this file is a manual or external process.

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
