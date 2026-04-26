import { withBuildId } from './buildId';

/**
 * Custom Next.js image loader.
 *
 * Next.js calls this function with { src, width, quality } for every <Image>
 * component and expects a URL back. We transform the URL to fit the CDN:
 * - Cloudinary: add resize + format parameters inline.
 * - Framer (framerusercontent.com): swap /assets/ for /images/ and add scale params.
 * - Local sleeve art: pick the closest pre-generated WebP size.
 * - Everything else: just append the build-id cache-buster.
 */
type LoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

export default function loader({ src, width, quality }: LoaderProps): string {
  if (src.includes("cloudinary"))
    return withBuildId(
      src
        .replace("http://", "https://")
        .replace("/upload/", `/upload/c_scale,w_${width},f_webp,q_${quality || 100}/`)
    );

  if (src.includes("framerusercontent.com"))
    return withBuildId(
      src
        .replace("http://", "https://")
        .replace("/assets/", "/images/")
        .replace(/(\.[a-z]{1,4})$/, `$1?scale-down-to=${width}&q=${quality || 75}`)
    );

  if (src.startsWith("/img/SMA_sleeve")) {
    const newWidth = Math.max(256, Math.ceil(width / 256) * 256);
    if (newWidth < 1024) return `/img/SMA_sleeve_${newWidth}.webp`;
    return "/img/SMA_sleeve.webp";
  }

  return withBuildId(src);
}
