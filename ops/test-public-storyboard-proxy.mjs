import { fetchProxiedStoryboardSheet } from "../scripts/build-video-thumbnails.mjs";
import { storyboardImageMetadata } from "../scripts/youtube-storyboard.mjs";

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error("Usage: node test-public-storyboard-proxy.mjs <proxy-url>");

let token = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) token += chunk;
token = token.trim();

const { level, sheet } = await fetchProxiedStoryboardSheet("pE5sH0hRFl8", {
  baseUrl,
  token,
});
token = "";

console.log(JSON.stringify({
  bytes: sheet.length,
  level,
  ...storyboardImageMetadata(sheet),
}));
