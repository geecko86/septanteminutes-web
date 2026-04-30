---
name: Project Code Conventions
description: File naming, util patterns, TypeScript style, and framer component conventions
type: project
---

**Utils:** All in `src/utils/`. Now all TypeScript (`.ts` / `.tsx`). Key utils (includes one JS stub):
- `scroll-snap-stub.js` — CommonJS no-op for server-side webpack externals (scroll-snap@5 crashes in Node.js)
- `episodeTitle.ts` — `getGuestName()` / `getEpisodeTopic()` extract parts from "Guest - Topic" titles
- `buildId.ts` — `withBuildId(url)` appends `?id=BUILD_ID` cache-buster
- `cdn_img_loader.ts` — Next.js custom image loader (cloudinary, framerusercontent, local)
- `normalizeStr.ts` — slug normalization for URL generation
- `PlayerContext.tsx` — shared audio playback context + MediaSession sync
- `browserCheck.tsx` — UA-based browser version guard (runs client-side only)

**Framer components:** Live in `src/framer/*.js` (auto-generated, kept as JS).
Ambient declarations in `src/framer/types.d.ts`. TypeScript bundler resolution does NOT match
the wildcard module patterns to relative imports — so local `FC<any>` aliases in page components
are still needed. Do not remove them without fixing module resolution first.

**Episode pages:** Two routes for the same component:
- `src/pages/[episodeNum]/index.tsx`
- `src/pages/podcast/interview/[episodeName]/index.tsx` (guest slug route)

**Scroll queue:** `pendingScrollActions` (was `funqueue`) in `[episodeNum]` page — queues scroll callbacks
when snap is mid-animation.

**Paralax constants** (index.tsx): FLOOR=0.3012, LAYER_1_5=1.15, LAYER_2=2.3, LAMP_1_5=0.27, LAMP_2=0.45.

**Why:** Consistency and findability. Inline magic numbers and typos were scattered; now centralized.
**How to apply:** When adding new timeouts or parallax factors in these files, add a named constant at
the top of the file rather than inlining.
