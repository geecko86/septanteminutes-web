---
name: Project Stack & Architecture
description: Core tech stack, router type, deployment target, and build tooling for septanteminutes-web
type: project
---

Next.js 15.5 Pages Router, fully static export (`output: "export"`) targeting Firebase Hosting.
Package manager: **yarn** (never npm). Node: `nvm use 22` (engine `>=22 <23`).
PWA via `@ducanh2912/next-pwa` with InjectManifest mode; custom `sw.js` at repo root.
Image loader: `src/utils/cdn_img_loader.ts` (custom Next.js loader, referenced in next.config.js).
CSS: custom webpack pipeline (style-loader + css-loader + postcss + cssnano), no Next.js built-in CSS.
The CSS pipeline is split server/client in next.config.js: server-side only uses css-loader (no
style-loader, which is browser-only); client-side uses the full style-loader + css-loader + postcss chain.
scroll-snap@5: ESM-only package. Client bundle aliases to the UMD dist file (javascript/auto).
Server compilation uses a webpack `externals` interceptor to swap `scroll-snap` → `src/utils/scroll-snap-stub.js`
(a safe no-op) because the UMD IIFE crashes in strict-mode Node.js where `this` is undefined.
Bundle analysis: `ANALYZE=true yarn build`.
193 static pages generated (95 episodes × 2 routes + misc).

Key dep versions locked: typescript@6.0.3, vitest@4.1.5, jsdom@29, eslint@9/10, eslint-config-next@16,
css-loader@7.1.4, style-loader@4.0.0, next-seo@7.2.0, scroll-snap@5.0.2.

**Why:** Static export + Firebase gives zero-server-cost hosting with full PWA support.
**How to apply:** Never use server-only Next.js features (no `getServerSideProps`, no API routes that need a Node server at runtime). Always run build with `nvm use 22` first.
