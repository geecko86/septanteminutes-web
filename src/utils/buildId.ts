/**
 * Appends the canonical client build ID as a cache-busting query parameter.
 *
 * Why: After a new deploy the static assets at a CDN edge node might still
 * serve the old version. Appending ?id=<buildId> (or &id= when the URL
 * already has a query string) forces browsers and CDN layers to treat the
 * URL as new and fetch the latest version.
 *
 * NEXT_PUBLIC_BUILD_ID is set by scripts/build.mjs before Next compiles either
 * the client or server output. Development and tests use a stable fallback.
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'development';

export function isValidBuildId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

export function withBuildId(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}id=${process.env.NEXT_PUBLIC_BUILD_ID || BUILD_ID}`;
}
