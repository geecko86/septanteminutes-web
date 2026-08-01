import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "public/generated/video-frames");
const M13_SHEET = 13;
const STORYBOARD_SOURCE = "storyboard-m13-320x180-v1";
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

export function storyboardLevelFromHtml(html) {
  const match = html.match(
    /"playerStoryboardSpecRenderer":\{"spec":"((?:\\.|[^"\\])*)"/,
  );
  if (!match) throw new Error("YouTube did not return a storyboard spec");

  const spec = JSON.parse(`"${match[1]}"`);
  const parts = spec.split("|");
  if (parts.length < 2) throw new Error("Malformed YouTube storyboard spec");

  const template = parts[0];
  const levelIndex = parts.length - 2;
  const levelParts = parts.at(-1).split("#");
  const [width, height, frameCount, columns, rows] = levelParts
    .slice(0, 5)
    .map(Number);
  const filename = levelParts[6]?.replace("$M", String(M13_SHEET));
  const signature = levelParts[7];

  if (![width, height, frameCount, columns, rows].every(Number.isFinite)) {
    throw new Error("Malformed YouTube storyboard level");
  }
  if ((M13_SHEET * columns * rows) >= frameCount) {
    throw new Error("Video is too short to contain storyboard sheet M13");
  }
  if (!filename || !signature) {
    throw new Error("YouTube storyboard level is missing its signed filename");
  }

  return {
    width,
    height,
    columns,
    rows,
    url: `${template
      .replace("$L", String(levelIndex))
      .replace("$N", filename)}&sigh=${signature}`,
  };
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

async function acquireLowResolutionFrame(videoId, destination) {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`YouTube watch page returned ${response.status}`);

  const level = storyboardLevelFromHtml(await response.text());
  if (level.width !== 320 || level.height !== 180) {
    throw new Error(`M13 storyboard is ${level.width}x${level.height}, not 320x180`);
  }
  const storyboard = await fetch(level.url, { signal: AbortSignal.timeout(30_000) });
  if (!storyboard.ok) throw new Error(`M13 storyboard returned ${storyboard.status}`);
  const sheet = Buffer.from(await storyboard.arrayBuffer());
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
    const validFallback = dimensions.width >= 640
      && dimensions.height >= 360
      && sourceMarker === MAXRES_SOURCE;
    if (refresh || (!validStoryboard && !validFallback)) {
      pendingFrames.push({ ...video, destination, dimensions, sourceMarker });
    }
  }

  if (pendingFrames.length === 0) return;

  for (const video of pendingFrames) {
    try {
      const tile = await acquireLowResolutionFrame(video.id, video.destination);
      writeFileSync(`${video.destination}.source`, `${STORYBOARD_SOURCE}\n`);
      console.log(`Episode ${video.number}: cached native M13 tile ${tile + 1}/9 (320x180)`);
    } catch (error) {
      console.warn(`Episode ${video.number}: ${error.message}; using maxres2 instead`);
      try {
        const format = await acquireMaxresFallback(video.id, video.destination);
        console.log(`Episode ${video.number}: cached maxres2 ${format} fallback`);
      } catch (fallbackError) {
        console.warn(`Episode ${video.number}: ${fallbackError.message}; browser fallback will be used`);
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
