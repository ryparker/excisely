import { createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  guardAuth: vi.fn(),
  extractLabelFieldsForApplicantWithType: vi.fn(),
  extractLabelFieldsWithAutoDetect: vi.fn(),
  validateImageUrl: vi.fn(),
}))

vi.mock('@/lib/auth/action-guards', () => ({
  guardAuth: mocks.guardAuth,
}))
vi.mock('@/lib/ai/extract-label', () => ({
  extractLabelFieldsForApplicantWithType:
    mocks.extractLabelFieldsForApplicantWithType,
  extractLabelFieldsWithAutoDetect: mocks.extractLabelFieldsWithAutoDetect,
}))
vi.mock('@/lib/validators/file-schema', () => ({
  validateImageUrl: mocks.validateImageUrl,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { extractFieldsFromImage } from './extract-fields-from-image'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_URL = 'https://abc.public.blob.vercel-storage.com/test.jpg'

function mockExtractionResult(overrides?: Record<string, unknown>) {
  return {
    fields: [
      {
        fieldName: 'brand_name',
        value: 'Old Tom Reserve',
        confidence: 95,
        reasoning: 'Clearly visible',
        boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.05, angle: 0 },
        imageIndex: 0,
      },
      {
        fieldName: 'alcohol_content',
        value: null,
        confidence: 0,
        reasoning: 'Not found',
        boundingBox: null,
        imageIndex: 0,
      },
    ],
    imageClassifications: [
      { imageIndex: 0, imageType: 'front', confidence: 98 },
    ],
    detectedBeverageType: 'distilled_spirits',
    processingTimeMs: 2500,
    modelUsed: 'gpt-4.1',
    rawResponse: {},
    metrics: {
      fetchTimeMs: 200,
      ocrTimeMs: 800,
      classificationTimeMs: 1200,
      mergeTimeMs: 50,
      totalTimeMs: 2500,
      wordCount: 120,
      imageCount: 1,
      inputTokens: 500,
      outputTokens: 300,
      totalTokens: 800,
    },
    ...overrides,
  }
}

function mockAuth() {
  const session = createSession()
  mocks.guardAuth.mockResolvedValue({ success: true, session })
  return session
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractFieldsFromImage', () => {
  beforeEach(() => {
    mocks.validateImageUrl.mockReturnValue(true)
    mocks.extractLabelFieldsWithAutoDetect.mockResolvedValue(
      mockExtractionResult(),
    )
    mocks.extractLabelFieldsForApplicantWithType.mockResolvedValue(
      mockExtractionResult(),
    )
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardAuth.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('allows both specialists and applicants (uses guardAuth)', async () => {
    const session = createSession({ role: 'applicant' })
    mocks.guardAuth.mockResolvedValue({ success: true, session })

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result.success).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('returns error when imageUrls is empty', async () => {
    mockAuth()
    const result = await extractFieldsFromImage({ imageUrls: [] })
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain(
      'At least one image URL',
    )
  })

  it('returns error when imageUrls exceeds 10', async () => {
    mockAuth()
    const urls = Array.from(
      { length: 11 },
      (_, i) => `https://example.com/${i}`,
    )
    const result = await extractFieldsFromImage({ imageUrls: urls })
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('Maximum 10')
  })

  it('returns error for invalid URL format', async () => {
    mockAuth()
    const result = await extractFieldsFromImage({
      imageUrls: ['not-a-url'],
    })
    expect(result.success).toBe(false)
  })

  it('returns error when URL fails image URL validation', async () => {
    mockAuth()
    mocks.validateImageUrl.mockReturnValue(false)

    const result = await extractFieldsFromImage({
      imageUrls: ['https://evil.com/image.jpg'],
    })
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('Invalid image URL')
  })

  // -------------------------------------------------------------------------
  // Auto-detect vs beverage-type-specified
  // -------------------------------------------------------------------------

  it('calls extractLabelFieldsWithAutoDetect when no beverageType is provided', async () => {
    mockAuth()

    await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(mocks.extractLabelFieldsWithAutoDetect).toHaveBeenCalledWith([
      VALID_URL,
    ])
    expect(mocks.extractLabelFieldsForApplicantWithType).not.toHaveBeenCalled()
  })

  it('calls extractLabelFieldsForApplicantWithType when beverageType is provided', async () => {
    mockAuth()

    await extractFieldsFromImage({
      imageUrls: [VALID_URL],
      beverageType: 'wine',
    })
    expect(mocks.extractLabelFieldsForApplicantWithType).toHaveBeenCalledWith(
      [VALID_URL],
      'wine',
    )
    expect(mocks.extractLabelFieldsWithAutoDetect).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Success — response shape
  // -------------------------------------------------------------------------

  it('filters out fields with null values', async () => {
    mockAuth()

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result.success).toBe(true)
    if (!result.success) return

    // The null-valued "alcohol_content" field should be filtered out
    expect(result.data.fields).toHaveLength(1)
    expect(result.data.fields[0].fieldName).toBe('brand_name')
  })

  it('strips internal fields (confidence, reasoning, angle) from response', async () => {
    mockAuth()

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result.success).toBe(true)
    if (!result.success) return

    const field = result.data.fields[0]
    expect(field).not.toHaveProperty('confidence')
    expect(field).not.toHaveProperty('reasoning')
    expect(field.boundingBox).not.toHaveProperty('angle')
  })

  it('returns imageClassifications and detectedBeverageType', async () => {
    mockAuth()

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.imageClassifications).toEqual([
      { imageIndex: 0, imageType: 'front', confidence: 98 },
    ])
    expect(result.data.detectedBeverageType).toBe('distilled_spirits')
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns error when AI extraction throws', async () => {
    mockAuth()
    mocks.extractLabelFieldsWithAutoDetect.mockRejectedValue(
      new Error('OCR service unavailable'),
    )

    const result = await extractFieldsFromImage({ imageUrls: [VALID_URL] })
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred during field extraction',
    })
  })
})
