import { nanoid } from 'nanoid'

import {
  createApplicationData,
  createLabel,
  createSession,
  createValidationResult,
} from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  guardSpecialist: vi.fn(),
  getLabelById: vi.fn(),
  getLabelAppData: vi.fn(),
  getLabelImages: vi.fn(),
  getCurrentValidationResult: vi.fn(),
  updateLabelStatus: vi.fn(),
  supersedeValidationResult: vi.fn(),
  runValidationPipeline: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/queries/labels', () => ({
  getLabelById: mocks.getLabelById,
  getLabelAppData: mocks.getLabelAppData,
  getLabelImages: mocks.getLabelImages,
}))
vi.mock('@/db/queries/validation', () => ({
  getCurrentValidationResult: mocks.getCurrentValidationResult,
}))
vi.mock('@/db/mutations/labels', () => ({
  updateLabelStatus: mocks.updateLabelStatus,
}))
vi.mock('@/db/mutations/validation', () => ({
  supersedeValidationResult: mocks.supersedeValidationResult,
}))
vi.mock('@/lib/actions/validation-pipeline', () => ({
  runValidationPipeline: mocks.runValidationPipeline,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { reanalyzeLabel } from './reanalyze-label'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const labelImageId = nanoid()
const labelImage = {
  id: labelImageId,
  labelId: 'lbl_test',
  imageUrl: 'https://blob.vercel-storage.com/test.jpg',
  imageFilename: 'test.jpg',
  imageType: 'front' as const,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function defaultPipelineOutput(overrides?: Record<string, unknown>) {
  return {
    validationResultId: nanoid(),
    overallStatus: 'approved',
    overallConfidence: 95,
    deadlineDays: null,
    autoApproved: false,
    extraction: {
      fields: [
        {
          fieldName: 'brand_name',
          value: 'Old Tom Reserve',
          confidence: 95,
          reasoning: 'Clearly visible',
          boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.05, angle: 0 },
          imageIndex: 0,
        },
      ],
      imageClassifications: [
        { imageIndex: 0, imageType: 'front', confidence: 98 },
      ],
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

function mockSpecialist() {
  const session = createSession()
  mocks.guardSpecialist.mockResolvedValue({ success: true, session })
  return session
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reanalyzeLabel', () => {
  beforeEach(() => {
    mocks.updateLabelStatus.mockResolvedValue(undefined)
    mocks.supersedeValidationResult.mockResolvedValue(undefined)
    mocks.getCurrentValidationResult.mockResolvedValue(null)
    mocks.runValidationPipeline.mockResolvedValue(defaultPipelineOutput())
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })
    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })
    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Label checks
  // -------------------------------------------------------------------------

  it('returns error when label not found', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(null)

    const result = await reanalyzeLabel('lbl_nonexistent')
    expect(result).toEqual({ success: false, error: 'Label not found' })
  })

  it('returns error when label is already processing', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ id: 'lbl_test', status: 'processing' }),
    )

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({
      success: false,
      error: 'Label is already being processed',
    })
  })

  // -------------------------------------------------------------------------
  // Error recovery
  // -------------------------------------------------------------------------

  it('restores original status on AI pipeline failure', async () => {
    mockSpecialist()
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])
    mocks.runValidationPipeline.mockRejectedValue(
      new Error('AI service unavailable'),
    )

    const result = await reanalyzeLabel('lbl_test')

    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toBe(
      'An unexpected error occurred during re-analysis',
    )

    // Verify status was set to 'processing' first, then restored to 'approved'
    expect(mocks.updateLabelStatus).toHaveBeenCalledTimes(2)
    expect(mocks.updateLabelStatus).toHaveBeenNthCalledWith(1, 'lbl_test', {
      status: 'processing',
    })
    expect(mocks.updateLabelStatus).toHaveBeenNthCalledWith(2, 'lbl_test', {
      status: 'approved',
    })
  })

  // -------------------------------------------------------------------------
  // Success flow
  // -------------------------------------------------------------------------

  it('calls runValidationPipeline with correct arguments', async () => {
    mockSpecialist()
    const label = createLabel({
      id: 'lbl_test',
      status: 'approved',
      beverageType: 'distilled_spirits',
    })
    const appData = createApplicationData({
      labelId: 'lbl_test',
      brandName: 'Test Brand',
    })

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])

    await reanalyzeLabel('lbl_test')

    expect(mocks.runValidationPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId: 'lbl_test',
        imageUrls: [labelImage.imageUrl],
        imageRecordIds: [labelImage.id],
        beverageType: 'distilled_spirits',
      }),
    )
  })

  it('supersedes previous validation result (isCurrent -> false)', async () => {
    mockSpecialist()
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })
    const prevResult = createValidationResult({
      labelId: 'lbl_test',
      isCurrent: true,
    })

    const newResultId = nanoid()

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])
    mocks.getCurrentValidationResult.mockResolvedValue(prevResult)
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({ validationResultId: newResultId }),
    )

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify supersedeValidationResult was called
    expect(mocks.supersedeValidationResult).toHaveBeenCalledWith(
      prevResult.id,
      newResultId,
    )
  })

  it('creates new validation result via pipeline', async () => {
    mockSpecialist()
    const label = createLabel({ id: 'lbl_test', status: 'pending_review' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify pipeline was called
    expect(mocks.runValidationPipeline).toHaveBeenCalled()
  })

  it('routes to pending_review when not auto-approved', async () => {
    mockSpecialist()
    const label = createLabel({
      id: 'lbl_test',
      status: 'approved',
      beverageType: 'distilled_spirits',
      containerSizeMl: 750,
    })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])
    mocks.runValidationPipeline.mockResolvedValue(
      defaultPipelineOutput({
        overallStatus: 'pending_review',
        autoApproved: false,
        deadlineDays: null,
      }),
    )

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Last updateLabelStatus call should set pending_review
    const calls = mocks.updateLabelStatus.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1].status).toBe('pending_review')
  })

  it('calls updateTag after successful reanalysis', async () => {
    mockSpecialist()
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getLabelAppData.mockResolvedValue(appData)
    mocks.getLabelImages.mockResolvedValue([labelImage])

    await reanalyzeLabel('lbl_test')

    expect(mocks.updateTag).toHaveBeenCalledWith('labels')
    expect(mocks.updateTag).toHaveBeenCalledWith('sla-metrics')
  })
})
