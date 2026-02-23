import {
  assessImageQuality,
  MIN_BYTES_PER_PIXEL_JPEG,
  MIN_DIMENSION_PX,
  RECOMMENDED_DIMENSION_PX,
} from '@/lib/validators/image-quality'

describe('assessImageQuality', () => {
  it('passes a good image', () => {
    const result = assessImageQuality(1920, 1080, 500_000, 'image/jpeg')
    expect(result.level).toBe('pass')
    expect(result.issues).toHaveLength(0)
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
  })

  it('errors when width is below minimum', () => {
    const result = assessImageQuality(50, 600, 100_000, 'image/jpeg')
    expect(result.level).toBe('error')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].code).toBe('too_small')
  })

  it('errors when height is below minimum', () => {
    const result = assessImageQuality(600, 50, 100_000, 'image/jpeg')
    expect(result.level).toBe('error')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].code).toBe('too_small')
  })

  it('warns on low resolution (below recommended but above minimum)', () => {
    const result = assessImageQuality(300, 300, 100_000, 'image/jpeg')
    expect(result.level).toBe('warning')
    expect(result.issues.some((i) => i.code === 'low_resolution')).toBe(true)
  })

  it('warns on high JPEG compression', () => {
    // 1000x1000 = 1M pixels, fileSize = 10_000 bytes => 0.01 bytes/pixel (< 0.05 threshold)
    const result = assessImageQuality(1000, 1000, 10_000, 'image/jpeg')
    expect(result.level).toBe('warning')
    expect(result.issues.some((i) => i.code === 'high_compression')).toBe(true)
  })

  it('skips compression check for non-JPEG images', () => {
    // Same tiny file size but PNG — should pass since dimensions are good
    const result = assessImageQuality(1000, 1000, 10_000, 'image/png')
    expect(result.level).toBe('pass')
    expect(result.issues).toHaveLength(0)
  })

  it('level remains error even when compression warning also applies', () => {
    // Both too small and heavily compressed — level stays error
    const result = assessImageQuality(50, 50, 1, 'image/jpeg')
    expect(result.level).toBe('error')
    expect(result.issues[0].code).toBe('too_small')
    // Compression issue is still reported alongside the error
    expect(result.issues.some((i) => i.code === 'high_compression')).toBe(true)
    // But low_resolution is skipped when error is already set
    expect(result.issues.some((i) => i.code === 'low_resolution')).toBe(false)
  })

  it('reports both low resolution and high compression warnings together', () => {
    // 300x300 (below recommended), 1 byte filesize (compressed)
    const result = assessImageQuality(300, 300, 1, 'image/jpeg')
    expect(result.level).toBe('warning')
    expect(result.issues.some((i) => i.code === 'low_resolution')).toBe(true)
    expect(result.issues.some((i) => i.code === 'high_compression')).toBe(true)
  })

  it('exports threshold constants', () => {
    expect(MIN_DIMENSION_PX).toBe(100)
    expect(RECOMMENDED_DIMENSION_PX).toBe(500)
    expect(MIN_BYTES_PER_PIXEL_JPEG).toBe(0.05)
  })
})
