export const INITIAL_SCENE_IMAGE_ATTRIBUTE = "data-initial-scene";

export type InitialSceneReadyResult = {
  imageCount: number;
  timedOut: boolean;
};

type InitialSceneReadyOptions = {
  root: HTMLElement;
  timeoutMs?: number;
  waitForFonts?: boolean;
};

const nextFrame = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => resolve());
  } else {
    setTimeout(resolve, 0);
  }
});

const isInInitialViewport = (image: HTMLImageElement) => {
  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return rect.right > 0
    && rect.bottom > 0
    && rect.left < window.innerWidth
    && rect.top < window.innerHeight;
};

const waitForImage = async (image: HTMLImageElement) => {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const finish = () => {
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };

      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  }

  if (image.naturalWidth > 0 && typeof image.decode === "function") {
    await image.decode().catch(() => undefined);
  }
};

/**
 * Wait for a finite, explicitly marked initial scene.
 *
 * Callers first await the device-specific component modules they need. Two
 * animation frames then let React mount those components and the layout settle.
 * At that point the marked, viewport-intersecting image list is frozen so later
 * route data and off-screen content can never extend the loading screen.
 */
export async function waitForInitialScene({
  root,
  timeoutMs = 12_000,
  waitForFonts = true,
}: InitialSceneReadyOptions): Promise<InitialSceneReadyResult> {
  await nextFrame();
  await nextFrame();

  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>(`img[${INITIAL_SCENE_IMAGE_ATTRIBUTE}="true"]`),
  ).filter(isInInitialViewport);

  const fontPromise = waitForFonts && "fonts" in document
    ? document.fonts.ready.then(() => undefined)
    : Promise.resolve();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });

  await Promise.race([
    Promise.all([fontPromise, ...images.map(waitForImage)]).then(() => undefined),
    timeoutPromise,
  ]);

  if (timeoutId) clearTimeout(timeoutId);
  return { imageCount: images.length, timedOut };
}
