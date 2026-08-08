// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForInitialScene } from "./initialSceneReady";

const makeImage = ({ visible = true, marked = true } = {}) => {
  const image = document.createElement("img");
  if (marked) image.dataset.initialScene = "true";
  Object.defineProperty(image, "complete", { configurable: true, value: true });
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 12 });
  image.getBoundingClientRect = () => ({
    bottom: visible ? 100 : -10,
    height: 100,
    left: 0,
    right: 100,
    top: visible ? 0 : -110,
    width: 100,
    x: 0,
    y: visible ? 0 : -110,
    toJSON: () => ({}),
  });
  image.decode = vi.fn(async () => undefined);
  return image;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("waitForInitialScene", () => {
  it("waits only for marked images in the initial viewport", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const root = document.createElement("main");
    const visible = makeImage();
    const offscreen = makeImage({ visible: false });
    const unmarked = makeImage({ marked: false });
    root.append(visible, offscreen, unmarked);
    document.body.append(root);

    const result = await waitForInitialScene({ root, waitForFonts: false });

    expect(result).toEqual({ imageCount: 1, timedOut: false });
    expect(visible.decode).toHaveBeenCalledOnce();
    expect(offscreen.decode).not.toHaveBeenCalled();
    expect(unmarked.decode).not.toHaveBeenCalled();
  });

  it("freezes the image list before later content is added", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    let finishDecode: (() => void) | undefined;
    const root = document.createElement("main");
    const first = makeImage();
    first.decode = vi.fn(() => new Promise<void>((resolve) => { finishDecode = resolve; }));
    root.append(first);
    document.body.append(root);

    const readiness = waitForInitialScene({ root, waitForFonts: false });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    root.append(makeImage());
    finishDecode?.();

    await expect(readiness).resolves.toEqual({ imageCount: 1, timedOut: false });
  });

  it("uses the timeout only as a failure escape hatch", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const root = document.createElement("main");
    const image = makeImage();
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    root.append(image);
    document.body.append(root);

    const readiness = waitForInitialScene({ root, timeoutMs: 25, waitForFonts: false });
    await vi.advanceTimersByTimeAsync(25);

    await expect(readiness).resolves.toEqual({ imageCount: 1, timedOut: true });
    vi.useRealTimers();
  });
});
