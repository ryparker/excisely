import { nanoid } from 'nanoid'

import { createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  after: vi.fn(),
  guardApplicant: vi.fn(),
  getApplicantByEmail: vi.fn(),
  insertLabel: vi.fn(),
  insertApplicationData: vi.fn(),
  insertLabelImages: vi.fn(),
  updateLabelStatus: vi.fn(),
  parseImageUrls: vi.fn(),
  runValidationPipeline: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/lib/auth/action-guards', () => ({
  guardApplicant: mocks.guardApplicant,
}))
vi.mock('@/db/queries/applicants', () => ({
  getApplicantByEmail: mocks.getApplicantByEmail,
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

import { submitApplication } from './submit-application'

// We need PipelineTimeoutError for testing timeout handling.
// Import the real class — it has no external dependencies.
import { PipelineTimeoutError } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockApplicant() {
  const session = createSession({
    role: 'applicant',
    name: 'Thomas Blackwell',
    email: 'labeling@oldtomdistillery.com',
  })
  mocks.guardApplicant.mockResolvedValue({ success: true, session })
  return session
}

function makeFormData(overrides?: Record<string, string>): FormData {
  const fd = new FormData()
  fd.set('beverageType', 'distilled_spirits')
  fd.set('containerSizeMl', '750')
  fd.set('brandName', 'Old Tom Reserve')
  fd.set(
    'imageUrls',
    JSON.stringify(['https://abc.public.blob.vercel-storage.com/front.jpg']),
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
    imageUrls: ['https://abc.public.blob.vercel-storage.com/front.jpg'],
  })
  mocks.getApplicantByEmail.mockResolvedValue({
    id: 'app_tom',
    companyName: 'Old Tom Distillery',
  })
  mocks.insertLabel.mockResolvedValue({ id: labelId })
  mocks.insertApplicationData.mockResolvedValue(undefined)
  mocks.insertLabelImages.mockResolvedValue([{ id: imageRecordId }])
  mocks.updateLabelStatus.mockResolvedValue(undefined)
  mocks.runValidationPipeline.mockResolvedValue(defaultPipelineOutput())
  // after() just runs callback immediately for testing — or we can ignore it
  mocks.after.mockImplementation((fn: () => void) => fn())

  return { labelId, imageRecordId }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitApplication', () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardApplicant.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is a specialist (not applicant)', async () => {
    mocks.guardApplicant.mockResolvedValue({
      success: false,
      error: 'Only applicants can perform this action',
    })

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'Only applicants can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Form validation
  // -------------------------------------------------------------------------

  it('returns error when brandName is missing', async () => {
    mockApplicant()
    const fd = makeFormData({ brandName: '' })

    const result = await submitApplication(fd)
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('Brand Name')
  })

  it('returns error when beverageType is invalid', async () => {
    mockApplicant()
    const fd = makeFormData({ beverageType: 'soda' })

    const result = await submitApplication(fd)
    expect(result.success).toBe(false)
  })

  it('returns error when containerSizeMl is not positive', async () => {
    mockApplicant()
    const fd = makeFormData({ containerSizeMl: '-100' })

    const result = await submitApplication(fd)
    expect(result.success).toBe(false)
  })

  it('returns error when containerSizeMl is not a whole number', async () => {
    mockApplicant()
    const fd = makeFormData({ containerSizeMl: '750.5' })

    const result = await submitApplication(fd)
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Image URL validation
  // -------------------------------------------------------------------------

  it('returns error when no image URLs provided', async () => {
    mockApplicant()
    mocks.parseImageUrls.mockReturnValue({
      success: false,
      error: 'No image URLs provided',
    })

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'No image URLs provided',
    })
  })

  // -------------------------------------------------------------------------
  // Record creation
  // -------------------------------------------------------------------------

  it('creates label with no specialist and applicant lookup', async () => {
    mockApplicant()
    const { labelId } = setupDefaults()

    await submitApplication(makeFormData())

    expect(mocks.insertLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: null,
        applicantId: 'app_tom',
        beverageType: 'distilled_spirits',
        containerSizeMl: 750,
        status: 'processing',
      }),
    )
  })

  it('sets applicantId to null when no applicant record found', async () => {
    mockApplicant()
    setupDefaults()
    mocks.getApplicantByEmail.mockResolvedValue(null)

    await submitApplication(makeFormData())

    expect(mocks.insertLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantId: null,
      }),
    )
  })

  it('creates application data record tied to the label', async () => {
    mockApplicant()
    const { labelId } = setupDefaults()

    const fd = makeFormData({
      fancifulName: 'Single Barrel Select',
      alcoholContent: '45% Alc./Vol.',
    })

    await submitApplication(fd)

    expect(mocks.insertApplicationData).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId,
        brandName: 'Old Tom Reserve',
        fancifulName: 'Single Barrel Select',
        alcoholContent: '45% Alc./Vol.',
      }),
    )
  })

  it('creates label image records with correct ordering', async () => {
    mockApplicant()
    const { labelId } = setupDefaults()
    mocks.parseImageUrls.mockReturnValue({
      success: true,
      imageUrls: [
        'https://abc.public.blob.vercel-storage.com/front.jpg',
        'https://abc.public.blob.vercel-storage.com/back.jpg',
      ],
    })
    mocks.insertLabelImages.mockResolvedValue([
      { id: 'img_1' },
      { id: 'img_2' },
    ])

    await submitApplication(makeFormData())

    expect(mocks.insertLabelImages).toHaveBeenCalledWith([
      expect.objectContaining({
        labelId,
        imageUrl: 'https://abc.public.blob.vercel-storage.com/front.jpg',
        imageType: 'front',
        sortOrder: 0,
      }),
      expect.objectContaining({
        labelId,
        imageUrl: 'https://abc.public.blob.vercel-storage.com/back.jpg',
        imageType: 'other',
        sortOrder: 1,
      }),
    ])
  })

  // -------------------------------------------------------------------------
  // Success: auto-approved
  // -------------------------------------------------------------------------

  it('returns approved status when pipeline auto-approves', async () => {
    mockApplicant()
    const { labelId } = setupDefaults()
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({ autoApproved: true, overallConfidence: 98 }),
    )

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({
      success: true,
      labelId,
      status: 'approved',
    })

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'approved',
      overallConfidence: '98',
    })
  })

  // -------------------------------------------------------------------------
  // Success: pending_review
  // -------------------------------------------------------------------------

  it('returns pending_review status when not auto-approved', async () => {
    mockApplicant()
    const { labelId } = setupDefaults()
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({
        autoApproved: false,
        overallStatus: 'needs_correction',
        overallConfidence: 72,
      }),
    )

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({
      success: true,
      labelId,
      status: 'pending_review',
    })

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'pending_review',
      aiProposedStatus: 'needs_correction',
      overallConfidence: '72',
    })
  })

  // -------------------------------------------------------------------------
  // Cache invalidation
  // -------------------------------------------------------------------------

  it('calls updateTag for labels and sla-metrics on success', async () => {
    mockApplicant()
    setupDefaults()

    await submitApplication(makeFormData())

    expect(mocks.updateTag).toHaveBeenCalledWith('labels')
    expect(mocks.updateTag).toHaveBeenCalledWith('sla-metrics')
  })

  // -------------------------------------------------------------------------
  // Pipeline timeout handling
  // -------------------------------------------------------------------------

  it('returns timeout error with timeout flag on PipelineTimeoutError', async () => {
    mockApplicant()
    setupDefaults()
    mocks.runValidationPipeline.mockRejectedValue(new PipelineTimeoutError())

    const result = await submitApplication(makeFormData())
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('taking longer than expected')
      expect(result.timeout).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // Generic error handling
  // -------------------------------------------------------------------------

  it('returns generic error on unexpected pipeline failure', async () => {
    mockApplicant()
    setupDefaults()
    mocks.runValidationPipeline.mockRejectedValue(
      new Error('AI service unavailable'),
    )

    const result = await submitApplication(makeFormData())
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred during submission',
    })
  })

  // -------------------------------------------------------------------------
  // Error recovery: reset label status via after()
  // -------------------------------------------------------------------------

  it('schedules label status reset to pending on pipeline failure', async () => {
    mockApplicant()
    setupDefaults()
    // Capture the callback passed to after()
    const afterCallbacks: Array<() => void> = []
    mocks.after.mockImplementation((fn: () => void) => {
      afterCallbacks.push(fn)
    })
    mocks.runValidationPipeline.mockRejectedValue(new Error('AI failure'))

    await submitApplication(makeFormData())

    // after() should have been called to schedule cleanup
    expect(afterCallbacks).toHaveLength(1)

    // Execute the scheduled callback
    await afterCallbacks[0]()

    // Verify the label status was reset to 'pending'
    const resetCall = mocks.updateLabelStatus.mock.calls.find(
      (call: unknown[]) =>
        (call[1] as Record<string, string>).status === 'pending',
    )
    expect(resetCall).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Applicant corrections transform
  // -------------------------------------------------------------------------

  it('passes rawResponseTransform when aiExtractedFields has corrections', async () => {
    mockApplicant()
    setupDefaults()

    const fd = makeFormData({ brandName: 'Corrected Brand Name' })
    fd.set(
      'aiExtractedFields',
      JSON.stringify({ brand_name: 'Original Brand' }),
    )

    await submitApplication(fd)

    // runValidationPipeline should have received a rawResponseTransform
    const pipelineCall = mocks.runValidationPipeline.mock.calls[0][0]
    expect(pipelineCall.rawResponseTransform).toBeDefined()

    // The transform should append applicantCorrections
    const transformed = pipelineCall.rawResponseTransform({
      existing: 'data',
    })
    expect(transformed).toEqual(
      expect.objectContaining({
        existing: 'data',
        applicantCorrections: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'brand_name',
            aiExtractedValue: 'Original Brand',
            applicantSubmittedValue: 'Corrected Brand Name',
          }),
        ]),
      }),
    )
  })

  it('does not pass rawResponseTransform when no corrections were made', async () => {
    mockApplicant()
    setupDefaults()

    const fd = makeFormData({ brandName: 'Same Name' })
    fd.set('aiExtractedFields', JSON.stringify({ brand_name: 'Same Name' }))

    await submitApplication(fd)

    const pipelineCall = mocks.runValidationPipeline.mock.calls[0][0]
    expect(pipelineCall.rawResponseTransform).toBeUndefined()
  })

  it('does not pass rawResponseTransform when aiExtractedFields is absent', async () => {
    mockApplicant()
    setupDefaults()

    await submitApplication(makeFormData())

    const pipelineCall = mocks.runValidationPipeline.mock.calls[0][0]
    expect(pipelineCall.rawResponseTransform).toBeUndefined()
  })
})
