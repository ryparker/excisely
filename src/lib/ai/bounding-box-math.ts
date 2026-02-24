import type { OcrWord } from '@/lib/ai/ocr'

// ---------------------------------------------------------------------------
// Bounding box geometry: vertices to normalized bbox + text angle
// ---------------------------------------------------------------------------

/**
 * Computes the dominant text reading angle (in degrees) from a set of OCR words.
 * Uses the baseline direction (vertex[0] -> vertex[1]) of each word to determine
 * how the text is oriented. Returns 0 for horizontal, 90 for top-to-bottom,
 * -90 for bottom-to-top, 180 for upside-down. Rounds to the nearest 90 degrees.
 */
export function computeTextAngle(words: OcrWord[]): number {
  if (words.length === 0) return 0

  // Accumulate the baseline direction vectors from all words
  let sumDx = 0
  let sumDy = 0

  for (const word of words) {
    const v = word.boundingPoly.vertices
    if (v.length < 2) continue
    // v[0] is top-left in reading direction, v[1] is top-right
    // The vector v[0]->v[1] points in the reading direction
    sumDx += v[1].x - v[0].x
    sumDy += v[1].y - v[0].y
  }

  if (sumDx === 0 && sumDy === 0) return 0

  // atan2 gives the angle in radians; convert to degrees
  const angleRad = Math.atan2(sumDy, sumDx)
  const angleDeg = (angleRad * 180) / Math.PI

  // Round to the nearest 90 degrees
  const snapped = Math.round(angleDeg / 90) * 90

  // Normalize to [-180, 180]
  if (snapped > 180) return snapped - 360
  if (snapped <= -180) return snapped + 360
  return snapped
}

/**
 * Computes a normalized bounding box (0-1 range) from a set of OCR words
 * and the source image dimensions.
 */
export function computeNormalizedBoundingBox(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
): {
  x: number
  y: number
  width: number
  height: number
  angle: number
} | null {
  if (words.length === 0 || imageWidth === 0 || imageHeight === 0) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const word of words) {
    for (const vertex of word.boundingPoly.vertices) {
      if (vertex.x < minX) minX = vertex.x
      if (vertex.y < minY) minY = vertex.y
      if (vertex.x > maxX) maxX = vertex.x
      if (vertex.y > maxY) maxY = vertex.y
    }
  }

  if (
    !isFinite(minX) ||
    !isFinite(minY) ||
    !isFinite(maxX) ||
    !isFinite(maxY)
  ) {
    return null
  }

  return {
    x: minX / imageWidth,
    y: minY / imageHeight,
    width: (maxX - minX) / imageWidth,
    height: (maxY - minY) / imageHeight,
    angle: computeTextAngle(words),
  }
}
