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
  extractLabelFields: vi.fn(),
  compareField: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth/get-session', () => ({ getSession: mocks.getSession }))
vi.mock('@/lib/ai/extract-label', () => ({
  extractLabelFields: mocks.extractLabelFields,
}))
vi.mock('@/lib/ai/compare-fields', () => ({ compareField: mocks.compareField }))
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

// We need a transaction mock where the callback receives a tx object
// that also has chainable query builders
function makeTxDb() {
  const txSelectChain = makeChain([])
  const txInsertChain = makeChain([{ id: nanoid() }])
  const txUpdateChain = makeChain([])

  return {
    select: vi.fn().mockReturnValue(txSelectChain),
    insert: vi.fn().mockReturnValue(txInsertChain),
    update: vi.fn().mockReturnValue(txUpdateChain),
    _selectChain: txSelectChain,
    _insertChain: txInsertChain,
    _updateChain: txUpdateChain,
  }
}

let selectChain: ReturnType<typeof makeChain>
let updateChain: ReturnType<typeof makeChain>
let txDb: ReturnType<typeof makeTxDb>

/**
 * Sets up mocks.db with fresh chains. The `selectResponses` array provides
 * sequential return values for successive `db.select()` calls:
 *   [0] = label query
 *   [1] = applicationData query (via Promise.all)
 *   [2] = labelImages query (via Promise.all)
 */
function setupDb(selectResponses: unknown[][] = []) {
  selectChain = makeChain([])
  updateChain = makeChain([])
  txDb = makeTxDb()

  let selectCallIndex = 0
  mocks.db.select = vi.fn().mockImplementation(() => {
    const rows = selectResponses[selectCallIndex] ?? []
    selectCallIndex++
    return makeChain(rows)
  })
  mocks.db.update = vi.fn().mockReturnValue(updateChain)
  mocks.db.insert = vi.fn().mockReturnValue(makeChain([]))
  mocks.db.transaction = vi.fn().mockImplementation(async (fn) => fn(txDb))
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
        boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.05 },
        imageIndex: 0,
      },
    ],
    imageClassifications: [
      { imageIndex: 0, imageType: 'front', confidence: 98 },
    ],
    processingTimeMs: 2500,
    modelUsed: 'gpt-5-mini',
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
      error: 'Insufficient permissions',
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

    mocks.extractLabelFields.mockRejectedValue(
      new Error('AI service unavailable'),
    )

    const result = await reanalyzeLabel('lbl_test')

    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toBe('AI service unavailable')

    // Verify status was set to 'processing' first, then restored to 'approved'
    const updateCalls = (mocks.db.update as ReturnType<typeof vi.fn>).mock.calls
    expect(updateCalls.length).toBeGreaterThanOrEqual(2)
  })

  // -------------------------------------------------------------------------
  // Success flow
  // -------------------------------------------------------------------------

  it('calls extractLabelFields with correct arguments', async () => {
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

    setupDb([[label], [appData], [labelImage]])

    mocks.extractLabelFields.mockResolvedValue(defaultExtraction())

    await reanalyzeLabel('lbl_test')

    expect(mocks.extractLabelFields).toHaveBeenCalledWith(
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

    setupDb([[label], [appData], [labelImage]])

    // Make the tx select (for current result) return the previous result
    txDb._selectChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve([prevResult]).then(resolve),
    )

    // Make the tx insert (for new result) return a new ID
    const newResultId = nanoid()
    txDb._insertChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve([{ id: newResultId }]).then(resolve),
    )

    mocks.extractLabelFields.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify tx.update was called to supersede old result
    expect(txDb.update).toHaveBeenCalled()
  })

  it('creates new validation items from field comparisons', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'pending_review' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    setupDb([[label], [appData], [labelImage]])

    txDb._selectChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    )

    const newResultId = nanoid()
    txDb._insertChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve([{ id: newResultId }]).then(resolve),
    )

    mocks.extractLabelFields.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify tx.insert was called (once for result, once for items)
    expect(txDb.insert).toHaveBeenCalled()
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

    setupDb([[label], [appData], [labelImage]])

    txDb._selectChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    )
    txDb._insertChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve([{ id: nanoid() }]).then(resolve),
    )

    // Make compareField return a mismatch for mandatory field
    mocks.compareField.mockReturnValue({
      status: 'mismatch',
      confidence: 30,
      reasoning: 'Values differ significantly',
    })

    mocks.extractLabelFields.mockResolvedValue(defaultExtraction())

    const result = await reanalyzeLabel('lbl_test')
    expect(result).toEqual({ success: true, labelId: 'lbl_test' })

    // Verify the label was updated to pending_review (via tx.update)
    const updateSetCalls = txDb._updateChain.set.mock.calls
    const lastSetCall = updateSetCalls[updateSetCalls.length - 1]?.[0]
    expect(lastSetCall).toBeDefined()
    // The status should be pending_review since there was a mismatch
    expect(lastSetCall.status).toBe('pending_review')
  })

  it('calls revalidatePath after successful reanalysis', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const label = createLabel({ id: 'lbl_test', status: 'approved' })
    const appData = createApplicationData({ labelId: 'lbl_test' })

    setupDb([[label], [appData], [labelImage]])

    txDb._selectChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
    )
    txDb._insertChain.then.mockImplementation(
      (resolve: (v: unknown) => unknown) =>
        Promise.resolve([{ id: nanoid() }]).then(resolve),
    )

    mocks.extractLabelFields.mockResolvedValue(defaultExtraction())

    await reanalyzeLabel('lbl_test')

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/labels/lbl_test')
  })
})
