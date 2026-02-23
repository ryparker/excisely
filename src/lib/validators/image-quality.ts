// ---------------------------------------------------------------------------
// Image quality assessment — pure function, no browser APIs
// ---------------------------------------------------------------------------

/** Minimum dimension (either axis) to allow processing. Below this = hard block. */
export const MIN_DIMENSION_PX = 100

/** Recommended dimension (either axis). Below this = soft warning. */
export const RECOMMENDED_DIMENSION_PX = 500

/** Minimum bytes-per-pixel for JPEG images. Below this = compression warning. */
export const MIN_BYTES_PER_PIXEL_JPEG = 0.05

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageQualityLevel = 'pass' | 'warning' | 'error'

export interface ImageQualityIssue {
  code: 'too_small' | 'low_resolution' | 'high_compression'
  message: string
}

export interface ImageQualityResult {
  level: ImageQualityLevel
  issues: ImageQualityIssue[]
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

/**
 * Assesses image quality based on dimensions and compression ratio.
 * Returns a result with level ('pass' | 'warning' | 'error') and any issues found.
 *
 * - Error (hard block): either axis < 100px
 * - Warning (soft): either axis < 500px, or JPEG bytes/pixel < 0.05
 * - Pass: no issues detected
 */
export function assessImageQuality(
  width: number,
  height: number,
  fileSize: number,
  mimeType: string,
): ImageQualityResult {
  const issues: ImageQualityIssue[] = []
  let level: ImageQualityLevel = 'pass'

  // Check minimum dimensions (hard block)
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    issues.push({
      code: 'too_small',
      message: `Image is ${width} × ${height}px — minimum ${MIN_DIMENSION_PX}px required on each axis`,
    })
    level = 'error'
  }

  // Check recommended dimensions (soft warning)
  if (
    level !== 'error' &&
    (width < RECOMMENDED_DIMENSION_PX || height < RECOMMENDED_DIMENSION_PX)
  ) {
    issues.push({
      code: 'low_resolution',
      message: `Image is ${width} × ${height}px — ${RECOMMENDED_DIMENSION_PX}px+ recommended for accurate text reading`,
    })
    level = 'warning'
  }

  // Check JPEG compression ratio (soft warning)
  if (mimeType === 'image/jpeg' && width > 0 && height > 0) {
    const bytesPerPixel = fileSize / (width * height)
    if (bytesPerPixel < MIN_BYTES_PER_PIXEL_JPEG) {
      issues.push({
        code: 'high_compression',
        message: `Image appears heavily compressed (${bytesPerPixel.toFixed(3)} bytes/pixel) — text may be unreadable`,
      })
      if (level === 'pass') level = 'warning'
    }
  }

  return { level, issues, width, height }
}
