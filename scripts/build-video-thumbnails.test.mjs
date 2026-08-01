import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acquireDeployedFrame,
  ensureJpegCompanion,
  fetchProxiedStoryboardSheet,
  pickMedoid,
  proxyConfigurationFromEnvironment,
  storyboardLevelFromHtml,
} from "./build-video-thumbnails.mjs";
import { storyboardImageMetadata } from "./youtube-storyboard.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, {
    force: true,
    recursive: true,
  })));
});

describe("storyboardLevelFromHtml", () => {
  it("selects the highest level and M13 without corrupting the signed query", () => {
    const spec = "https://i.ytimg.com/sb/video/storyboard3_L$L/$N.jpg?sqp=signed|160#90#200#5#5#10000#M$M#rs$Lower|320#180#200#3#3#10000#M$M#rs$AHash";
    const escaped = JSON.stringify(spec).slice(1, -1);
    const level = storyboardLevelFromHtml(`{"playerStoryboardSpecRenderer":{"spec":"${escaped}"}}`);

    expect(level).toEqual({
      width: 320,
      height: 180,
      columns: 3,
      rows: 3,
      url: "https://i.ytimg.com/sb/video/storyboard3_L1/M13.jpg?sqp=signed&sigh=rs$AHash",
    });
  });

  it("rejects videos that do not reach sheet M13", () => {
    const spec = "https://i.ytimg.com/sb/video/storyboard3_L$L/$N.jpg?sqp=signed|320#180#100#3#3#10000#M$M#rs$AHash";
    expect(() => storyboardLevelFromHtml(`{"playerStoryboardSpecRenderer":{"spec":"${spec}"}}`))
      .toThrow("too short");
  });
});

describe("pickMedoid", () => {
  it("selects a representative of the recurring camera view", () => {
    const guest = [
      Buffer.from([10, 10]),
      Buffer.from([11, 9]),
      Buffer.from([9, 11]),
      Buffer.from([12, 10]),
      Buffer.from([10, 12]),
    ];
    const host = [
      Buffer.from([220, 220]),
      Buffer.from([221, 219]),
      Buffer.from([219, 221]),
      Buffer.from([222, 220]),
    ];

    expect(pickMedoid([...guest, ...host])).toBeLessThan(guest.length);
  });
});

describe("acquireDeployedFrame", () => {
  it("preserves a valid deployed WebP and bypasses stale CDN entries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "video-frame-test-"));
    temporaryDirectories.push(directory);
    const destination = join(directory, "frame.webp");
    const deployed = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: "#806040",
      },
    }).webp().toBuffer();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(deployed, { status: 200 }),
    );

    await expect(acquireDeployedFrame("pE5sH0hRFl8", destination)).resolves.toEqual({
      width: 320,
      height: 180,
    });
    expect(await readFile(destination)).toEqual(deployed);
    expect(await readFile(`${destination}.source`, "utf8"))
      .toBe("deployed-production-frame-v1\n");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.hostname).toBe("www.septanteminutes.be");
    expect(url.searchParams.has("build-fallback")).toBe(true);
    expect(options.headers).toEqual({ "cache-control": "no-cache" });
  });

  it("rejects a deployed asset that is not a 16:9 WebP", async () => {
    const directory = await mkdtemp(join(tmpdir(), "video-frame-test-"));
    temporaryDirectories.push(directory);
    const destination = join(directory, "frame.webp");
    const invalid = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: "#806040",
      },
    }).webp().toBuffer();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(invalid, { status: 200 }),
    );

    await expect(acquireDeployedFrame("pE5sH0hRFl8", destination))
      .rejects.toThrow("not a valid 16:9 WebP");
  });
});

describe("fetchProxiedStoryboardSheet", () => {
  it("authenticates to an HTTPS endpoint and validates the returned sheet", async () => {
    const sheet = await sharp({
      create: {
        width: 960,
        height: 540,
        channels: 3,
        background: "#806040",
      },
    }).jpeg().toBuffer();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(sheet, {
      headers: {
        "content-type": "image/jpeg",
        "x-storyboard-columns": "3",
        "x-storyboard-height": "180",
        "x-storyboard-rows": "3",
        "x-storyboard-width": "320",
      },
      status: 200,
    }));

    const result = await fetchProxiedStoryboardSheet("pE5sH0hRFl8", {
      baseUrl: "https://pi.example.test/private",
      token: "secret-token",
    });
    expect(result.level).toEqual({ columns: 3, height: 180, rows: 3, width: 320 });
    expect(result.sheet).toEqual(sheet);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.href).toBe("https://pi.example.test/private/v1/storyboards/pE5sH0hRFl8/m13");
    expect(options.headers).toEqual({
      accept: "image/webp,image/jpeg",
      authorization: "Bearer secret-token",
    });
  });

  it("refuses a non-HTTPS remote proxy", async () => {
    await expect(fetchProxiedStoryboardSheet("pE5sH0hRFl8", {
      baseUrl: "http://pi.example.test",
      token: "secret-token",
    })).rejects.toThrow("must use HTTPS");
  });
});

describe("proxyConfigurationFromEnvironment", () => {
  const secrets = {
    STORYBOARD_PROXY_TOKEN: "secret-token",
    STORYBOARD_PROXY_URL: "https://pi.example.test",
  };

  it("ignores proxy secrets during local builds", () => {
    expect(proxyConfigurationFromEnvironment(secrets)).toBeNull();
  });

  it("enables the proxy only inside GitHub Actions", () => {
    expect(proxyConfigurationFromEnvironment({ ...secrets, GITHUB_ACTIONS: "true" }))
      .toEqual({ baseUrl: secrets.STORYBOARD_PROXY_URL, token: secrets.STORYBOARD_PROXY_TOKEN });
  });
});

describe("storyboardImageMetadata", () => {
  it.each(["jpeg", "webp"])("reads dimensions from a %s storyboard", async (format) => {
    const pipeline = sharp({
      create: {
        width: 960,
        height: 540,
        channels: 3,
        background: "#806040",
      },
    });
    const buffer = await pipeline[format]().toBuffer();

    expect(storyboardImageMetadata(buffer)).toEqual({
      format,
      height: 540,
      width: 960,
    });
  });
});

describe("ensureJpegCompanion", () => {
  it("creates a same-size JPEG next to a generated WebP", async () => {
    const directory = await mkdtemp(join(tmpdir(), "video-frame-test-"));
    temporaryDirectories.push(directory);
    const webp = join(directory, "frame.webp");
    await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: "#806040",
      },
    }).webp().toFile(webp);

    const jpeg = await ensureJpegCompanion(webp);
    await expect(sharp(jpeg).metadata()).resolves.toMatchObject({
      format: "jpeg",
      height: 180,
      width: 320,
    });
  });
});
