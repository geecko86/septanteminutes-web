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
Bundle analysis: `ANALYZE=true yarn build`.
193 static pages generated (95 episodes × 2 routes + misc).

**Why:** Static export + Firebase gives zero-server-cost hosting with full PWA support.
**How to apply:** Never use server-only Next.js features (no `getServerSideProps`, no API routes that need a Node server at runtime). Always run build with `nvm use 22` first.
