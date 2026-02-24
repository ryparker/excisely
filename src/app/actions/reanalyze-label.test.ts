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
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  extractLabelFieldsForSubmission: vi.fn(),
  compareField: vi.fn(),
  getAutoApprovalEnabled: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth/get-session', () => ({ getSession: mocks.getSession }))
vi.mock('@/lib/ai/extract-label', () => ({
  extractLabelFieldsForSubmission: mocks.extractLabelFieldsForSubmission,
}))
vi.mock('@/lib/ai/compare-fields', () => ({ compareField: mocks.compareField }))
vi.mock('@/lib/settings/get-settings', () => ({
  getAutoApprovalEnabled: mocks.getAutoApprovalEnabled,
}))
vi.mock('@/db', () => ({ db: mocks.db }))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { reanalyzeLabel } from './reanalyze-label'
import type { ExtractionResult } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// Chain + DB helpers
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[] = []) {
  const self: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of [
    'select',
    'from',
    'where',
    'limit',
    'into',
    'set',
    'values',
    'returning',
    'orderBy',
  ]) {
    self[m] = vi.fn().mockReturnValue(self)
  }
  self.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve),
    )
  return self
}

let updateChain: ReturnType<typeof makeChain>

/**
 * Sets up mocks.db with fresh chains.
 *
 * `selectResponses` provides sequential return values for db.select() calls:
 *   [0] = label query
 *   [1] = applicationData query (via Promise.all)
 *   [2] = labelImages query (via Promise.all)
 *   [3] = currentResult query (for superseding)
 *
 * `insertResponses` provides sequential return values for db.insert() calls:
 *   [0] = new validationResult (needs returning { id })
 *   [1] = validationItems (return value unused)
 */
function setupDb(
  selectResponses: unknown[][] = [],
  insertResponses: unknown[][] = [[{ id: nanoid() }], []],
) {
  updateChain = makeChain([])

  let selectCallIndex = 0
  mocks.db.select = vi.fn().mockImplementation(() => {
    const rows = selectResponses[selectCallIndex] ?? []
    selectCallIndex++
    return makeChain(rows)
  })

  let insertCallIndex = 0
  mocks.db.insert = vi.fn().mockImplementation(() => {
    const rows = insertResponses[insertCallIndex] ?? []
    insertCallIndex++
    return makeChain(rows)
  })

  mocks.db.update = vi.fn().mockReturnValue(updateChain)
}

// ---------------------------------------------------------------------------
// Default AI extraction result
// ---------------------------------------------------------------------------

function defaultExtraction(
  overrides?: Partial<ExtractionResult>,
): ExtractionResult {
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
    ...overrides,
  }
}

// Label image fixture
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reanalyzeLabel', () => {
  beforeEach(() => {
    mocks.compareField.mockReturnValue({
      status: 'match',
      confidence: 95,
      reasoning: 'Exact match',
    })
    mocks.getAutoApprovalEnabled.mockResolvedValue(false)
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.getSession.mockResolvedValue(createSession({ role: 'applicant' }))
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
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([[]]) // label query returns empty

    const result = await reanalyzeLabel('lbl_nonexistent')
    expect(result).toEqual({ success: false, error: 'Label not found' })
  })

  it('returns error when label is already processing', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([[createLabel({ id: 'lbl_test', status: 'processing' })]])

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
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    setupDb([
      [label], // label query
      [appData], // applicationData query
      [labelImage], // labelImages query
    ])

    mocks.extractLabelFieldsForSubmission.mockRejectedValue(
      new Error('AI service unavailable'),
    )

    const result = await reanalyzeLabel('lbl_test')

    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toBe(
      'An unexpected error occurred during re-analysis',
    )

    // Verify status was set to 'processing' first, then restored to 'approved'
    const updateCalls = (mocks.db.update as ReturnType<typeof vi.fn>).mock.calls
    expect(updateCalls.length).toBeGreaterThanOrEqual(2)
  })

  // -------------------------------------------------------------------------
  // Success flow
  // -------------------------------------------------------------------------

  it('calls extractLabelFieldsForSubmission with correct arguments', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({
      id: 'lbl_test',
      status: 'approved',
      beverageType: 'distilled_spirits',
    })
    const appData = createApplicationData({
      labelId: 'lbl_test',
      brandName: 'Test Brand',
    })

    setupDb([
      [label], // label query
      [appData], // applicationData query
      [labelImage], // labelImages query
      [], // currentResult query (none)
    ])

    mocks.extractLabelFieldsForSubmission.mockResolvedValue(defaultExtraction())

    await reanalyzeLabel('lbl_test')

    expect(mocks.extractLabelFieldsForSubmission).toHaveBeenCalledWith(
      [labelImage.imageUrl],
      'distilled_spirits',
      expect.any(Object),
    )
  })

  it('supersedes previous validation result (isCurrent -> false)', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })
    const prevResult = createValidationResult({
      labelId: 'lbl_test',
      isCurrent: true,
    })

    const newResultId = nanoid()

    setupDb(
      [
        [label], // label query
        [appData], // applicationData query
        [labelImage], // labelImages query
        [prevResult], // currentResult query returns previous result
      ],
      [
        [{ id: newResultId }], // new validationResult insert
        [], // validationItems insert
      ],
    )

    mocks.extractLabelFieldsForSubmission.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify db.update was called to supersede old result
    expect(mocks.db.update).toHaveBeenCalled()
  })

  it('creates new validation items from field comparisons', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'pending_review' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    const newResultId = nanoid()

    setupDb(
      [
        [label], // label query
        [appData], // applicationData query
        [labelImage], // labelImages query
        [], // currentResult query (none)
      ],
      [
        [{ id: newResultId }], // new validationResult insert
        [], // validationItems insert
      ],
    )

    mocks.extractLabelFieldsForSubmission.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify db.insert was called (once for result, once for items)
    expect(mocks.db.insert).toHaveBeenCalled()
  })

  it('routes to pending_review when mismatches found', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({
      id: 'lbl_test',
      status: 'approved',
      beverageType: 'distilled_spirits',
      containerSizeMl: 750,
    })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    const newResultId = nanoid()

    setupDb(
      [
        [label], // label query
        [appData], // applicationData query
        [labelImage], // labelImages query
        [], // currentResult query (none)
      ],
      [
        [{ id: newResultId }], // new validationResult insert
        [], // validationItems insert
      ],
    )

    // Make compareField return a mismatch for mandatory field
    mocks.compareField.mockReturnValue({
      status: 'mismatch',
      confidence: 30,
      reasoning: 'Values differ significantly',
    })

    mocks.extractLabelFieldsForSubmission.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify the label was updated to pending_review (via db.update)
    const updateSetCalls = updateChain.set.mock.calls
    const lastSetCall = updateSetCalls[updateSetCalls.length - 1]?.[0]
    expect(lastSetCall).toBeDefined()
    // The status should be pending_review since auto-approval is disabled
    expect(lastSetCall.status).toBe('pending_review')
  })

  it('calls revalidatePath after successful reanalysis', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    const newResultId = nanoid()

    setupDb(
      [
        [label], // label query
        [appData], // applicationData query
        [labelImage], // labelImages query
        [], // currentResult query (none)
      ],
      [
        [{ id: newResultId }], // new validationResult insert
        [], // validationItems insert
      ],
    )

    mocks.extractLabelFieldsForSubmission.mockResolvedValue(defaultExtraction())

    await reanalyzeLabel('lbl_test')

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/labels/lbl_test')
  })
})
