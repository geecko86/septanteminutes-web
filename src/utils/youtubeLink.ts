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

// A real frame from the video (auto-extracted by YouTube, 320x180).
// Deliberately NOT mqdefault.jpg: that's the hand-made thumbnail, which
// carries big title text and would look wrong printed as a photo. mq1/mq2/mq3
// are frames from the first/middle/last third — their positions are FIXED, so
// none of them can guarantee the guest is in frame (depends on each episode's
// cut); mq3 (last third) chosen by the owner.
export function getYoutubeFrameUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mq3.jpg`;
}
