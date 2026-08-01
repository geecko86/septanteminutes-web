// Validation of the optional `youtubeLink` episode field (populated by the
// getEpisodesFromRSS Cloud Function, or by hand in Firestore).
//
// Returns the 11-character video id when the link is a valid YouTube watch
// URL, or null otherwise. Anything that isn't a plain youtube.com/watch?v=
// (or youtu.be/) https link is rejected — the field is machine-written, so a
// mismatch means bad data, not a format to accommodate.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function getYoutubeVideoId(link?: string): string | null {
  if (!link) return null;

  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  let id: string | null = null;
  if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
    if (url.pathname !== "/watch") return null;
    id = url.searchParams.get("v");
  } else if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1);
  } else {
    return null;
  }

  return id && VIDEO_ID.test(id) ? id : null;
}

// The build pipeline writes either a native 320x180 M13 storyboard tile or a
// maxres2 YouTube fallback at this stable local URL. Keeping both sources
// behind one path makes the acquisition fallback invisible to the component.
export function getGeneratedYoutubeFrameUrl(videoId: string): string {
  return `/generated/video-frames/${videoId}.webp`;
}

// Network fallback for a missing build artifact. This does not guarantee that
// the guest is pictured, but it keeps the YouTube link usable if acquisition
// failed before the build.
export function getYoutubeFrameUrl(
  videoId: string,
  retry = 0,
  format: "jpg" | "webp" = "jpg",
): string {
  const directory = format === "webp" ? "vi_webp" : "vi";
  const frameUrl = `https://i.ytimg.com/${directory}/${videoId}/maxres2.${format}`;

  // A failed external image request can be retained by the browser or the
  // service worker for the current URL. A retry gets a distinct request while
  // keeping the selected maxres2 frame exactly the same.
  return retry > 0 ? `${frameUrl}?retry=${retry}` : frameUrl;
}
