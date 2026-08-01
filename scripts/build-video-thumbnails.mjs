import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { fetchYoutubeStoryboardSheet } from "./youtube-storyboard.mjs";
export { fetchYoutubeStoryboardSheet, storyboardLevelFromHtml } from "./youtube-storyboard.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "public/generated/video-frames");
const STORYBOARD_SOURCE = "storyboard-m13-320x180-v1";
const DEPLOYED_SOURCE = "deployed-production-frame-v1";
const MAXRES_SOURCE = "maxres2-after-storyboard-v1";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const overrides = JSON.parse(
  readFileSync(join(ROOT, "scripts/video-thumbnail-tiles.json"), "utf8"),
);

function youtubeId(link) {
  try {
    const url = new URL(link);
    const id = url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v");
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function pickMedoid(vectors) {
  if (vectors.length === 0) throw new Error("Cannot select from zero tiles");
  if (vectors.length === 1) return 0;

  // The M13 sheet usually contains a majority run of the guest camera. Use
  // the image whose four nearest neighbours are most similar, which selects
  // that recurring camera view without a face-recognition model.
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const neighbours = Math.min(4, vectors.length - 1);

  for (let index = 0; index < vectors.length; index += 1) {
    const distances = [];
    for (let other = 0; other < vectors.length; other += 1) {
      if (index === other) continue;
      let distance = 0;
      for (let pixel = 0; pixel < vectors[index].length; pixel += 1) {
        distance += Math.abs(vectors[index][pixel] - vectors[other][pixel]);
      }
      distances.push(distance);
    }
    distances.sort((a, b) => a - b);
    const score = distances.slice(0, neighbours).reduce((sum, value) => sum + value, 0);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

async function responseBuffer(response, description) {
  const maxStoryboardBytes = 8 * 1024 * 1024;
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxStoryboardBytes) {
    throw new Error(`${description} is larger than 8 MiB`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxStoryboardBytes) {
    throw new Error(`${description} is larger than 8 MiB`);
  }
  return buffer;
}

export function proxyConfigurationFromEnvironment(environment = process.env) {
  // The tunnel exists specifically to move hosted GitHub/Azure requests onto
  // the residential Pi connection. Local builds must keep using YouTube
  // directly, even if a developer happens to have copied the CI secrets.
  if (environment.GITHUB_ACTIONS !== "true") return null;

  const baseUrl = environment.STORYBOARD_PROXY_URL?.trim();
  const token = environment.STORYBOARD_PROXY_TOKEN?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

export async function fetchProxiedStoryboardSheet(
  videoId,
  configuration = proxyConfigurationFromEnvironment(),
) {
  if (!VIDEO_ID.test(videoId)) throw new Error("Invalid YouTube video ID");
  if (!configuration) throw new Error("storyboard proxy is not configured");

  const url = new URL(configuration.baseUrl);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("storyboard proxy URL must use HTTPS");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/storyboards/${videoId}/m13`;
  url.search = "";
  url.hash = "";

  const response = await fetch(url, {
    headers: {
      accept: "image/webp,image/jpeg",
      authorization: `Bearer ${configuration.token}`,
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`storyboard proxy returned ${response.status}`);

  const level = {
    width: Number(response.headers.get("x-storyboard-width")),
    height: Number(response.headers.get("x-storyboard-height")),
    columns: Number(response.headers.get("x-storyboard-columns")),
    rows: Number(response.headers.get("x-storyboard-rows")),
  };
  if (
    level.width !== 320
    || level.height !== 180
    || !Number.isInteger(level.columns)
    || !Number.isInteger(level.rows)
    || level.columns < 1
    || level.rows < 1
  ) {
    throw new Error("storyboard proxy returned invalid sheet metadata");
  }

  const sheet = await responseBuffer(response, "proxied M13 storyboard");
  const metadata = await sharp(sheet).metadata();
  if (
    !["jpeg", "webp"].includes(metadata.format)
    || (metadata.width ?? 0) < level.width * level.columns
    || (metadata.height ?? 0) < level.height * level.rows
  ) {
    throw new Error("storyboard proxy returned an invalid image sheet");
  }
  return { level, sheet };
}

async function acquireLowResolutionFrame(videoId, destination) {
  let storyboard;
  try {
    storyboard = await fetchYoutubeStoryboardSheet(videoId);
  } catch (directError) {
    if (!proxyConfigurationFromEnvironment()) throw directError;
    console.warn(`Direct storyboard request failed: ${directError.message}; trying secured proxy`);
    storyboard = await fetchProxiedStoryboardSheet(videoId);
  }

  const { level, sheet } = storyboard;
  const tileCount = level.columns * level.rows;
  const vectors = [];

  for (let index = 0; index < tileCount; index += 1) {
    const left = (index % level.columns) * level.width;
    const top = Math.floor(index / level.columns) * level.height;
    const vector = await sharp(sheet)
      .extract({ left, top, width: level.width, height: level.height })
      .resize(32, 18, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    vectors.push(vector);
  }

  const selected = Number.isInteger(overrides[videoId])
    ? overrides[videoId]
    : pickMedoid(vectors);
  if (selected < 0 || selected >= tileCount) {
    throw new Error(`Configured tile ${selected} is outside the M13 sheet`);
  }

  const left = (selected % level.columns) * level.width;
  const top = Math.floor(selected / level.columns) * level.height;
  const temporary = `${destination}.storyboard.webp`;
  try {
    await sharp(sheet)
      .extract({ left, top, width: level.width, height: level.height })
      // Keep the native 320x180 storyboard resolution. WebP avoids enlarging
      // the asset while still using the component's stable local URL.
      .webp({ quality: 90 })
      .toFile(temporary);
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return selected;
}

export async function acquireDeployedFrame(videoId, destination) {
  const url = new URL(
    `/generated/video-frames/${videoId}.webp`,
    "https://www.septanteminutes.be",
  );
  // Firebase serves WebPs with a one-year max-age. A unique query ensures this
  // build receives the asset from the current release, not an older CDN entry.
  url.searchParams.set("build-fallback", String(Date.now()));
  const temporary = `${destination}.deployed.webp`;

  try {
    const response = await fetch(url, {
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`deployed frame returned ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const aspectRatio = height > 0 ? width / height : 0;
    if (
      metadata.format !== "webp"
      || width < 240
      || height < 180
      || Math.abs(aspectRatio - (16 / 9)) > 0.08
    ) {
      throw new Error("deployed frame is not a valid 16:9 WebP");
    }

    // Preserve the already-encoded production asset byte-for-byte so repeated
    // fallback builds never introduce another lossy WebP generation.
    await writeFile(temporary, buffer);
    await rename(temporary, destination);
    writeFileSync(`${destination}.source`, `${DEPLOYED_SOURCE}\n`);
    return { width, height };
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function ensureJpegCompanion(webpDestination, force = false) {
  const jpegDestination = webpDestination.replace(/\.webp$/, ".jpg");
  if (jpegDestination === webpDestination) {
    throw new Error("Generated WebP destination must end in .webp");
  }

  const sourceMetadata = await sharp(webpDestination).metadata();
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;
  if (!sourceWidth || !sourceHeight) throw new Error("Generated WebP has no dimensions");

  if (!force && existsSync(jpegDestination)) {
    try {
      const metadata = await sharp(jpegDestination).metadata();
      if (
        metadata.format === "jpeg"
        && metadata.width === sourceWidth
        && metadata.height === sourceHeight
      ) {
        return jpegDestination;
      }
    } catch {
      // Replace a corrupt or mislabeled companion below.
    }
  }

  const temporary = `${jpegDestination}.temporary`;
  try {
    await sharp(webpDestination).jpeg({ quality: 90 }).toFile(temporary);
    await rename(temporary, jpegDestination);
    return jpegDestination;
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

async function acquireMaxresFallback(videoId, destination) {
  const candidates = [
    `https://i.ytimg.com/vi_webp/${videoId}/maxres2.webp`,
    `https://i.ytimg.com/vi/${videoId}/maxres2.jpg`,
  ];
  let lastError = new Error("YouTube did not return a maxres2 thumbnail");

  for (const url of candidates) {
    const temporary = `${destination}.fallback.webp`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}`);

      const image = sharp(Buffer.from(await response.arrayBuffer()));
      const metadata = await image.metadata();
      if ((metadata.width ?? 0) < 640 || (metadata.height ?? 0) < 360) {
        throw new Error(`${new URL(url).pathname} returned a low-resolution placeholder`);
      }

      await image.webp({ quality: 90 }).toFile(temporary);
      await rename(temporary, destination);
      writeFileSync(`${destination}.source`, `${MAXRES_SOURCE}\n`);
      return url.endsWith(".webp") ? "WebP" : "JPEG";
    } catch (error) {
      lastError = error;
      await unlink(temporary).catch(() => {});
    }
  }

  throw lastError;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const data = JSON.parse(await readFile(join(ROOT, "public/js/data.json"), "utf8"));
  const onlyVideoId = process.env.VIDEO_THUMBNAILS_ONLY;
  const videos = Object.values(data.episodes)
    .map((episode) => ({ id: youtubeId(episode.youtubeLink), number: episode.num }))
    .filter((episode) => episode.id && (!onlyVideoId || episode.id === onlyVideoId));
  const refresh = process.env.VIDEO_THUMBNAILS_REFRESH === "1";
  const pendingFrames = [];

  for (const video of videos) {
    const destination = join(OUTPUT_DIR, `${video.id}.webp`);
    let dimensions = { width: 0, height: 0 };
    if (existsSync(destination)) {
      try {
        const metadata = await sharp(destination).metadata();
        dimensions = {
          width: metadata.width ?? 0,
          height: metadata.height ?? 0,
        };
      } catch {
        dimensions = { width: 0, height: 0 };
      }
    }

    const sourceMarker = existsSync(`${destination}.source`)
      ? readFileSync(`${destination}.source`, "utf8").trim()
      : "";
    const validStoryboard = dimensions.width === 320
      && dimensions.height === 180
      && sourceMarker === STORYBOARD_SOURCE;
    const validDeployedFrame = dimensions.width >= 240
      && dimensions.height >= 180
      && sourceMarker === DEPLOYED_SOURCE;
    const validFallback = dimensions.width >= 640
      && dimensions.height >= 360
      && sourceMarker === MAXRES_SOURCE;
    const validFrame = validStoryboard || validDeployedFrame || validFallback;
    if (!refresh && validFrame) {
      await ensureJpegCompanion(destination).catch((error) => {
        console.warn(`Episode ${video.number}: could not create JPEG companion: ${error.message}`);
      });
    }
    if (refresh || !validFrame) {
      pendingFrames.push({ ...video, destination, dimensions, sourceMarker });
    }
  }

  if (pendingFrames.length === 0) return;

  for (const video of pendingFrames) {
    try {
      const tile = await acquireLowResolutionFrame(video.id, video.destination);
      writeFileSync(`${video.destination}.source`, `${STORYBOARD_SOURCE}\n`);
      await ensureJpegCompanion(video.destination, true);
      console.log(`Episode ${video.number}: cached native M13 tile ${tile + 1}/9 (320x180)`);
    } catch (error) {
      console.warn(`Episode ${video.number}: ${error.message}; trying deployed frame`);
      try {
        const dimensions = await acquireDeployedFrame(video.id, video.destination);
        await ensureJpegCompanion(video.destination, true);
        console.log(
          `Episode ${video.number}: cached deployed ${dimensions.width}x${dimensions.height} frame`,
        );
      } catch (deployedError) {
        console.warn(`Episode ${video.number}: ${deployedError.message}; using maxres2 instead`);
        try {
          const format = await acquireMaxresFallback(video.id, video.destination);
          await ensureJpegCompanion(video.destination, true);
          console.log(`Episode ${video.number}: cached maxres2 ${format} fallback`);
        } catch (fallbackError) {
          console.warn(`Episode ${video.number}: ${fallbackError.message}; browser fallback will be used`);
        }
      }
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    // Thumbnail generation must never prevent the website itself from building.
    console.warn(`Video thumbnail preprocessing skipped: ${error.message}`);
  });
}
