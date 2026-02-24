/**
 * Convert screen (clientX/Y) to normalized 0-1 image coordinates.
 * Uses getBoundingClientRect() on the <img> element so it automatically
 * accounts for any CSS transforms (scale, translate, origin-center) without
 * needing to manually invert the transform matrix.
 */
export function screenToNormalizedCoords(
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
): { x: number; y: number } | null {
  if (!container) return null
  const imageEl = container.querySelector('img')
  if (!imageEl) return null

  const imageRect = imageEl.getBoundingClientRect()
  if (imageRect.width === 0 || imageRect.height === 0) return null

  return {
    x: Math.max(0, Math.min(1, (clientX - imageRect.left) / imageRect.width)),
    y: Math.max(0, Math.min(1, (clientY - imageRect.top) / imageRect.height)),
  }
}
