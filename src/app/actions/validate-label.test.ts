import { nanoid } from 'nanoid'

import { createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  guardSpecialist: vi.fn(),
  insertLabel: vi.fn(),
  insertApplicationData: vi.fn(),
  insertLabelImages: vi.fn(),
  updateLabelStatus: vi.fn(),
  parseImageUrls: vi.fn(),
  runValidationPipeline: vi.fn(),
}))

vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/mutations/labels', () => ({
  insertLabel: mocks.insertLabel,
  insertApplicationData: mocks.insertApplicationData,
  insertLabelImages: mocks.insertLabelImages,
  updateLabelStatus: mocks.updateLabelStatus,
}))
vi.mock('@/lib/actions/parse-image-urls', () => ({
  parseImageUrls: mocks.parseImageUrls,
}))
vi.mock('@/lib/actions/validation-pipeline', () => ({
  runValidationPipeline: mocks.runValidationPipeline,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { validateLabel } from './validate-label'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSpecialist() {
  const session = createSession()
  mocks.guardSpecialist.mockResolvedValue({ success: true, session })
  return session
}

function makeFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('beverageType', 'distilled_spirits')
  fd.set('containerSizeMl', '750')
  fd.set('brandName', 'Old Tom Reserve')
  fd.set(
    'imageUrls',
    JSON.stringify(['https://abc.public.blob.vercel-storage.com/test.jpg']),
  )
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      fd.set(key, value)
    }
  }
  return fd
}

function defaultPipelineOutput(overrides?: Record<string, unknown>) {
  return {
    validationResultId: nanoid(),
    overallStatus: 'approved',
    overallConfidence: 95,
    deadlineDays: null,
    autoApproved: false,
    extraction: {
      fields: [],
      imageClassifications: [],
      processingTimeMs: 2500,
      modelUsed: 'gpt-5-mini',
      rawResponse: {},
      detectedBeverageType: null,
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
    },
    ...overrides,
  }
}

function setupDefaults() {
  const labelId = nanoid()
  const imageRecordId = nanoid()

  mocks.parseImageUrls.mockReturnValue({
    success: true,
    imageUrls: ['https://abc.public.blob.vercel-storage.com/test.jpg'],
  })
  mocks.insertLabel.mockResolvedValue({ id: labelId })
  mocks.insertApplicationData.mockResolvedValue(undefined)
  mocks.insertLabelImages.mockResolvedValue([{ id: imageRecordId }])
  mocks.updateLabelStatus.mockResolvedValue(undefined)
  mocks.runValidationPipeline.mockResolvedValue(defaultPipelineOutput())

  return { labelId, imageRecordId }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateLabel', () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Form validation
  // -------------------------------------------------------------------------

  it('returns error when brandName is missing', async () => {
    mockSpecialist()
    const fd = makeFormData({ brandName: '' })

    const result = await validateLabel(fd)
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('Brand Name')
  })

  it('returns error when beverageType is invalid', async () => {
    mockSpecialist()
    const fd = makeFormData({ beverageType: 'juice' })

    const result = await validateLabel(fd)
    expect(result.success).toBe(false)
  })

  it('returns error when containerSizeMl is not a positive number', async () => {
    mockSpecialist()
    const fd = makeFormData({ containerSizeMl: '0' })

    const result = await validateLabel(fd)
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Image URL validation
  // -------------------------------------------------------------------------

  it('returns error when no image URLs provided', async () => {
    mockSpecialist()
    mocks.parseImageUrls.mockReturnValue({
      success: false,
      error: 'No image URLs provided',
    })

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'No image URLs provided',
    })
  })

  // -------------------------------------------------------------------------
  // Success: auto-approved
  // -------------------------------------------------------------------------

  it('sets status to approved when pipeline auto-approves', async () => {
    mockSpecialist()
    const { labelId } = setupDefaults()
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({ autoApproved: true, overallConfidence: 98 }),
    )

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({ success: true, labelId })

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'approved',
      overallConfidence: '98',
    })
  })

  // -------------------------------------------------------------------------
  // Success: pending_review
  // -------------------------------------------------------------------------

  it('sets status to pending_review when not auto-approved', async () => {
    mockSpecialist()
    const { labelId } = setupDefaults()
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({
        autoApproved: false,
        overallStatus: 'needs_correction',
        overallConfidence: 72,
      }),
    )

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({ success: true, labelId })

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'pending_review',
      aiProposedStatus: 'needs_correction',
      overallConfidence: '72',
    })
  })

  // -------------------------------------------------------------------------
  // Record creation
  // -------------------------------------------------------------------------

  it('creates label with specialistId from session', async () => {
    const session = mockSpecialist()
    setupDefaults()

    await validateLabel(makeFormData())

    expect(mocks.insertLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: session.user.id,
        beverageType: 'distilled_spirits',
        containerSizeMl: 750,
        status: 'processing',
      }),
    )
  })

  it('creates application data tied to the label', async () => {
    mockSpecialist()
    const { labelId } = setupDefaults()

    await validateLabel(makeFormData())

    expect(mocks.insertApplicationData).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId,
        brandName: 'Old Tom Reserve',
      }),
    )
  })

  it('creates label image records', async () => {
    mockSpecialist()
    const { labelId } = setupDefaults()

    await validateLabel(makeFormData())

    expect(mocks.insertLabelImages).toHaveBeenCalledWith([
      expect.objectContaining({
        labelId,
        imageUrl: 'https://abc.public.blob.vercel-storage.com/test.jpg',
        imageType: 'front',
        sortOrder: 0,
      }),
    ])
  })

  // -------------------------------------------------------------------------
  // Pipeline invocation
  // -------------------------------------------------------------------------

  it('passes correct arguments to runValidationPipeline', async () => {
    mockSpecialist()
    const { labelId, imageRecordId } = setupDefaults()

    await validateLabel(makeFormData())

    expect(mocks.runValidationPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId,
        imageUrls: ['https://abc.public.blob.vercel-storage.com/test.jpg'],
        imageRecordIds: [imageRecordId],
        beverageType: 'distilled_spirits',
        containerSizeMl: 750,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns generic error when pipeline throws', async () => {
    mockSpecialist()
    setupDefaults()
    mocks.runValidationPipeline.mockRejectedValue(
      new Error('AI service unavailable'),
    )

    const result = await validateLabel(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred during validation',
    })
  })
})
