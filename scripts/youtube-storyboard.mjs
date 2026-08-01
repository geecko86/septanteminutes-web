const M13_SHEET = 13;
const MAX_STORYBOARD_BYTES = 8 * 1024 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

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

async function responseBuffer(response, description) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_STORYBOARD_BYTES) {
    throw new Error(`${description} is larger than 8 MiB`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_STORYBOARD_BYTES) {
    throw new Error(`${description} is larger than 8 MiB`);
  }
  return buffer;
}

// Read image dimensions without an image library. Keeping this module
// dependency-free lets the Pi service run on its existing Node installation
// without installing the website toolchain.
export function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return null;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if (startOfFrame.has(marker)) {
      if (length < 7) return null;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (
    buffer.length < 30
    || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WEBP"
  ) return null;

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      height: 1 + buffer.readUIntLE(27, 3),
      width: 1 + buffer.readUIntLE(24, 3),
    };
  }
  if (
    chunk === "VP8 "
    && buffer[23] === 0x9d
    && buffer[24] === 0x01
    && buffer[25] === 0x2a
  ) {
    return {
      height: buffer.readUInt16LE(28) & 0x3fff,
      width: buffer.readUInt16LE(26) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    return {
      height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6)),
      width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
    };
  }
  return null;
}

export function storyboardImageMetadata(buffer) {
  const jpeg = jpegDimensions(buffer);
  if (jpeg) return { ...jpeg, format: "jpeg" };
  const webp = webpDimensions(buffer);
  if (webp) return { ...webp, format: "webp" };
  return null;
}

export async function fetchYoutubeStoryboardSheet(videoId) {
  if (!VIDEO_ID.test(videoId)) throw new Error("Invalid YouTube video ID");

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
  const sheet = await responseBuffer(storyboard, "M13 storyboard");
  const metadata = storyboardImageMetadata(sheet);
  if (
    !metadata
    || metadata.width < level.width * level.columns
    || metadata.height < level.height * level.rows
  ) {
    const received = metadata
      ? `${metadata.format} ${metadata.width}x${metadata.height}`
      : `unrecognized image ${sheet.subarray(0, 12).toString("hex")}`;
    throw new Error(
      `M13 storyboard returned an invalid image sheet (${received}; expected at least ${level.width * level.columns}x${level.height * level.rows})`,
    );
  }

  return { format: metadata.format, level, sheet };
}
