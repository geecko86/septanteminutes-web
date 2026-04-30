// TypeScript 6 added TS2882: side-effect imports of non-JS/TS modules (like CSS)
// are now flagged unless the module has a declaration. This file is a pure
// ambient declaration file (no imports, so no module boundary) which makes the
// `declare module` statements here globally visible to the entire project.
//
// Why a separate file: src/framer/types.d.ts has a top-level `import type`
// which makes it a module file — ambient `declare module` in a module file are
// not globally visible. This file intentionally has no imports.

declare module 'rc-slider/assets/index.css' {}

// scroll-snap@5 ships a "bundler-style" index.d.ts that uses internal
// `declare module "index"` notation which TypeScript's moduleResolution:bundler
// cannot resolve as a standard ES module export. We declare the public API here
// to give TypeScript a usable type for `import createScrollSnap from "scroll-snap"`.
declare module 'scroll-snap' {
  export interface ScrollSnapSettings {
    snapDestinationX?: string | number;
    snapDestinationY?: string | number;
    timeout?: number;
    duration?: number;
    threshold?: number;
    snapStop?: boolean;
    easing?: (t: number) => number;
    showArrows?: boolean;
    enableKeyboard?: boolean;
  }
  export default function createScrollSnap(
    element: HTMLElement,
    settings?: ScrollSnapSettings,
    callback?: () => void
  ): { bind: () => void; unbind: () => void };
}
