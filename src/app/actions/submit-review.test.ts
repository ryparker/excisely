import { nanoid } from 'nanoid'

import {
  createLabel,
  createSession,
  createValidationItem,
  createValidationResult,
} from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  guardSpecialist: vi.fn(),
  getLabelById: vi.fn(),
  getCurrentValidationResult: vi.fn(),
  getValidationItems: vi.fn(),
  getValidationItemsForLabel: vi.fn(),
  updateLabelStatus: vi.fn(),
  insertHumanReview: vi.fn(),
  updateValidationItemStatus: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/queries/labels', () => ({
  getLabelById: mocks.getLabelById,
}))
vi.mock('@/db/queries/validation', () => ({
  getCurrentValidationResult: mocks.getCurrentValidationResult,
  getValidationItems: mocks.getValidationItems,
  getValidationItemsForLabel: mocks.getValidationItemsForLabel,
}))
vi.mock('@/db/mutations/labels', () => ({
  updateLabelStatus: mocks.updateLabelStatus,
}))
vi.mock('@/db/mutations/reviews', () => ({
  insertHumanReview: mocks.insertHumanReview,
}))
vi.mock('@/db/mutations/validation', () => ({
  updateValidationItemStatus: mocks.updateValidationItemStatus,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { submitReview } from './submit-review'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSpecialist() {
  const session = createSession()
  mocks.guardSpecialist.mockResolvedValue({ success: true, session })
  return session
}

function makeFormData(
  labelId: string,
  overrides: Array<{
    validationItemId: string
    originalStatus: string
    resolvedStatus: string
    reviewerNotes?: string
  }>,
): FormData {
  const fd = new FormData()
  fd.set('labelId', labelId)
  fd.set('overrides', JSON.stringify(overrides))
  return fd
}

function setupReviewableLabel(
  labelId: string,
  itemIds: string[],
  options?: { status?: string; beverageType?: string },
) {
  const label = createLabel({
    id: labelId,
    status: (options?.status as 'pending_review') ?? 'pending_review',
    beverageType:
      (options?.beverageType as 'distilled_spirits') ?? 'distilled_spirits',
  })
  const valResult = createValidationResult({ labelId })

  const valItems = itemIds.map((id) =>
    createValidationItem({
      id,
      validationResultId: valResult.id,
      status: 'mismatch',
    }),
  )

  mocks.getLabelById.mockResolvedValue(label)
  mocks.getValidationItemsForLabel.mockResolvedValue(valItems)
  mocks.getCurrentValidationResult.mockResolvedValue(valResult)
  // After overrides are applied, return items as all match by default
  mocks.getValidationItems.mockResolvedValue(
    valItems.map((item) => ({ ...item, status: 'match' })),
  )

  return { label, valResult, valItems }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitReview', () => {
  beforeEach(() => {
    mocks.updateLabelStatus.mockResolvedValue(undefined)
    mocks.insertHumanReview.mockResolvedValue(undefined)
    mocks.updateValidationItemStatus.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    const fd = makeFormData('lbl_1', [])
    const result = await submitReview(fd)
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })

    const fd = makeFormData('lbl_1', [])
    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Form data parsing
  // -------------------------------------------------------------------------

  it('returns error when overrides field is missing', async () => {
    mockSpecialist()
    const fd = new FormData()
    fd.set('labelId', 'lbl_1')
    // No overrides field

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'No review overrides provided',
    })
  })

  it('returns error when overrides is invalid JSON', async () => {
    mockSpecialist()
    const fd = new FormData()
    fd.set('labelId', 'lbl_1')
    fd.set('overrides', 'not-json')

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'Invalid overrides format',
    })
  })

  it('returns error when labelId is missing', async () => {
    mockSpecialist()
    const fd = new FormData()
    fd.set('overrides', '[]')
    // No labelId

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'Missing label ID',
    })
  })

  // -------------------------------------------------------------------------
  // Zod validation
  // -------------------------------------------------------------------------

  it('returns error when override has invalid resolvedStatus', async () => {
    mockSpecialist()
    const fd = makeFormData('lbl_1', [
      {
        validationItemId: 'vi_1',
        originalStatus: 'mismatch',
        resolvedStatus: 'invalid_status',
      },
    ])

    const result = await submitReview(fd)
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Label checks
  // -------------------------------------------------------------------------

  it('returns error when label not found', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(null)

    const fd = makeFormData('lbl_missing', [])
    const result = await submitReview(fd)
    expect(result).toEqual({ success: false, error: 'Label not found' })
  })

  it('returns error when label status is not reviewable', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ id: 'lbl_1', status: 'approved' }),
    )

    const fd = makeFormData('lbl_1', [])
    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'Label status "approved" is not eligible for review',
    })
  })

  it('allows review of pending_review labels', async () => {
    mockSpecialist()
    const itemId = nanoid()
    setupReviewableLabel('lbl_pr', [itemId])

    const fd = makeFormData('lbl_pr', [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({ success: true })
  })

  it('allows review of needs_correction labels', async () => {
    mockSpecialist()
    const itemId = nanoid()
    setupReviewableLabel('lbl_nc', [itemId], { status: 'needs_correction' })

    const fd = makeFormData('lbl_nc', [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({ success: true })
  })

  it('allows review of conditionally_approved labels', async () => {
    mockSpecialist()
    const itemId = nanoid()
    setupReviewableLabel('lbl_ca', [itemId], {
      status: 'conditionally_approved',
    })

    const fd = makeFormData('lbl_ca', [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({ success: true })
  })

  // -------------------------------------------------------------------------
  // Validation item ownership
  // -------------------------------------------------------------------------

  it('returns error when validation item does not belong to label', async () => {
    mockSpecialist()
    const labelId = 'lbl_owned'
    const validItemId = nanoid()
    const foreignItemId = nanoid()

    setupReviewableLabel(labelId, [validItemId])

    const fd = makeFormData(labelId, [
      {
        validationItemId: foreignItemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'Invalid validation item',
    })
  })

  // -------------------------------------------------------------------------
  // Override application
  // -------------------------------------------------------------------------

  it('creates human review and updates validation item for each override', async () => {
    const session = mockSpecialist()
    const labelId = 'lbl_review'
    const itemId = nanoid()

    setupReviewableLabel(labelId, [itemId])

    const fd = makeFormData(labelId, [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
        reviewerNotes: 'Verified on label',
      },
    ])

    await submitReview(fd)

    expect(mocks.insertHumanReview).toHaveBeenCalledWith(
      expect.objectContaining({
        specialistId: session.user.id,
        labelId,
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
        reviewerNotes: 'Verified on label',
      }),
    )

    expect(mocks.updateValidationItemStatus).toHaveBeenCalledWith(
      itemId,
      'match',
    )
  })

  // -------------------------------------------------------------------------
  // Overall status determination
  // -------------------------------------------------------------------------

  it('sets label to approved when all items are match after overrides', async () => {
    mockSpecialist()
    const labelId = 'lbl_approve'
    const itemId = nanoid()

    setupReviewableLabel(labelId, [itemId])

    const fd = makeFormData(labelId, [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    await submitReview(fd)

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'approved',
      correctionDeadline: null,
    })
  })

  it('returns error when no validation result is found', async () => {
    mockSpecialist()
    const labelId = 'lbl_noval'
    const itemId = nanoid()

    setupReviewableLabel(labelId, [itemId])
    mocks.getCurrentValidationResult.mockResolvedValue(null)

    const fd = makeFormData(labelId, [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'No validation result found for label',
    })
  })

  // -------------------------------------------------------------------------
  // Cache invalidation
  // -------------------------------------------------------------------------

  it('calls updateTag after successful review', async () => {
    mockSpecialist()
    const labelId = 'lbl_tags'
    const itemId = nanoid()

    setupReviewableLabel(labelId, [itemId])

    const fd = makeFormData(labelId, [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    await submitReview(fd)

    expect(mocks.updateTag).toHaveBeenCalledWith('labels')
    expect(mocks.updateTag).toHaveBeenCalledWith('sla-metrics')
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns generic error when database throws', async () => {
    mockSpecialist()
    const labelId = 'lbl_err'
    const itemId = nanoid()

    setupReviewableLabel(labelId, [itemId])
    mocks.insertHumanReview.mockRejectedValue(
      new Error('Database connection lost'),
    )

    const fd = makeFormData(labelId, [
      {
        validationItemId: itemId,
        originalStatus: 'mismatch',
        resolvedStatus: 'match',
      },
    ])

    const result = await submitReview(fd)
    expect(result).toEqual({
      success: false,
      error: 'An unexpected error occurred during review submission',
    })
  })
})
