import { once } from "node:events";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoryboardProxyServer } from "./storyboard-proxy.mjs";

const servers = [];
const token = "a-secure-random-token-with-more-than-32-characters";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, "close");
  }));
});

async function listen(server) {
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

describe("storyboard proxy", () => {
  it("rejects requests without its bearer token before fetching YouTube", async () => {
    const fetchStoryboard = vi.fn();
    const baseUrl = await listen(createStoryboardProxyServer({ fetchStoryboard, token }));

    const response = await fetch(`${baseUrl}/v1/storyboards/pE5sH0hRFl8/m13`);

    expect(response.status).toBe(401);
    expect(fetchStoryboard).not.toHaveBeenCalled();
  });

  it("returns only a validated video ID's M13 sheet to an authenticated caller", async () => {
    const sheet = await sharp({
      create: {
        width: 960,
        height: 540,
        channels: 3,
        background: "#806040",
      },
    }).jpeg().toBuffer();
    const fetchStoryboard = vi.fn().mockResolvedValue({
      level: { columns: 3, height: 180, rows: 3, width: 320 },
      sheet,
    });
    const baseUrl = await listen(createStoryboardProxyServer({ fetchStoryboard, token }));

    const response = await fetch(`${baseUrl}/v1/storyboards/pE5sH0hRFl8/m13`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-storyboard-width")).toBe("320");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(sheet);
    expect(fetchStoryboard).toHaveBeenCalledWith("pE5sH0hRFl8");
  });
});
