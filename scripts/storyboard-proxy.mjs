import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

import { fetchYoutubeStoryboardSheet } from "./youtube-storyboard.mjs";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function tokenMatches(value, expected) {
  if (!value?.startsWith("Bearer ")) return false;
  const received = Buffer.from(value.slice(7), "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

function sendJson(response, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": payload.length,
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(payload);
}

export function createStoryboardProxyServer({ token, fetchStoryboard = fetchYoutubeStoryboardSheet }) {
  if (typeof token !== "string" || token.length < 32) {
    throw new Error("STORYBOARD_PROXY_TOKEN must contain at least 32 characters");
  }

  let activeRequests = 0;
  return createServer(async (request, response) => {
    if (!tokenMatches(request.headers.authorization, token)) {
      response.setHeader("www-authenticate", "Bearer");
      sendJson(response, 401, { error: "unauthorized" });
      return;
    }
    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      sendJson(response, 405, { error: "method not allowed" });
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const match = url.pathname.match(/^\/v1\/storyboards\/([^/]+)\/m13$/);
    const videoId = match?.[1];
    if (!videoId || !VIDEO_ID.test(videoId)) {
      sendJson(response, 404, { error: "not found" });
      return;
    }
    if (activeRequests >= 2) {
      response.setHeader("retry-after", "5");
      sendJson(response, 429, { error: "busy" });
      return;
    }

    activeRequests += 1;
    try {
      const { format = "jpeg", level, sheet } = await fetchStoryboard(videoId);
      response.writeHead(200, {
        "cache-control": "private, no-store",
        "content-length": sheet.length,
        "content-type": format === "webp" ? "image/webp" : "image/jpeg",
        "x-content-type-options": "nosniff",
        "x-storyboard-columns": level.columns,
        "x-storyboard-height": level.height,
        "x-storyboard-rows": level.rows,
        "x-storyboard-width": level.width,
      });
      response.end(sheet);
    } catch (error) {
      console.error(`Storyboard request for ${videoId} failed:`, error.message);
      sendJson(response, 502, { error: "upstream request failed" });
    } finally {
      activeRequests -= 1;
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const token = process.env.STORYBOARD_PROXY_TOKEN;
  const host = process.env.STORYBOARD_PROXY_HOST || "127.0.0.1";
  const port = Number(process.env.STORYBOARD_PROXY_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("STORYBOARD_PROXY_PORT must be a valid TCP port");
  }

  const server = createStoryboardProxyServer({ token });
  server.listen(port, host, () => {
    console.log(`Storyboard proxy listening on http://${host}:${port}`);
  });
}
