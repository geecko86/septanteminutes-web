/**
 * Appends a BUILD_ID cache-busting query parameter to a URL.
 *
 * Why: After a new deploy the static assets at a CDN edge node might still
 * serve the old version. Appending ?id=<buildId> (or &id= when the URL
 * already has a query string) forces browsers and CDN layers to treat the
 * URL as new and fetch the latest version.
 *
 * BUILD_ID is injected by the webpack DefinePlugin in next.config.js and
 * defaults to 0 in development / test environments where it is not set.
 */
export function withBuildId(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}id=${process.env.BUILD_ID || 0}`;
}
