/** URL scheme prefix for locally-stored files */
export const LOCAL_URL_PREFIX = 'local://'

export function isLocalUrl(url: string): boolean {
  return url.startsWith(LOCAL_URL_PREFIX)
}

export function isBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com')
}

/**
 * Returns a browser-accessible URL for an image.
 * - Blob URLs: routes through /api/blob/image proxy (needs token)
 * - Local URLs: routes through /api/blob/image proxy (reads from disk)
 * - External URLs: returned as-is
 *
 * This function is safe for client bundles (no Node.js APIs).
 */
export function getSignedImageUrl(url: string): string {
  if (isBlobUrl(url) || isLocalUrl(url)) {
    return `/api/blob/image?url=${encodeURIComponent(url)}`
  }
  return url
}
