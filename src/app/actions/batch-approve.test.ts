import { nanoid } from 'nanoid'

import {
  createLabel,
  createSession,
  createValidationItem,
} from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  guardSpecialist: vi.fn(),
  getLabelById: vi.fn(),
  getCurrentValidationItems: vi.fn(),
  updateLabelStatus: vi.fn(),
  insertStatusOverride: vi.fn(),
  getApprovalThreshold: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/queries/labels', () => ({
  getLabelById: mocks.getLabelById,
}))
vi.mock('@/db/queries/validation', () => ({
  getCurrentValidationItems: mocks.getCurrentValidationItems,
}))
vi.mock('@/db/mutations/labels', () => ({
  updateLabelStatus: mocks.updateLabelStatus,
}))
vi.mock('@/db/mutations/reviews', () => ({
  insertStatusOverride: mocks.insertStatusOverride,
}))
vi.mock('@/db/queries/settings', () => ({
  getApprovalThreshold: mocks.getApprovalThreshold,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { batchApprove } from './batch-approve'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSpecialist() {
  const session = createSession()
  mocks.guardSpecialist.mockResolvedValue({ success: true, session })
  return session
}

/** Sets up a label that qualifies for batch approval. */
function setupApprovableLabel(labelId: string) {
  const label = createLabel({
    id: labelId,
    status: 'pending_review',
    overallConfidence: '95',
  })
  const items = [
    createValidationItem({
      fieldName: 'brand_name',
      status: 'match',
    }),
    createValidationItem({
      fieldName: 'health_warning',
      status: 'match',
    }),
  ]

  mocks.getLabelById.mockImplementation((id: string) =>
    id === labelId ? label : null,
  )
  mocks.getCurrentValidationItems.mockImplementation((id: string) =>
    id === labelId ? items : [],
  )

  return { label, items }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('batchApprove', () => {
  beforeEach(() => {
    mocks.updateLabelStatus.mockResolvedValue(undefined)
    mocks.insertStatusOverride.mockResolvedValue(undefined)
    mocks.getApprovalThreshold.mockResolvedValue(80)
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })

    const result = await batchApprove(['lbl_1'])
    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
      approvedCount: 0,
      failedIds: [],
    })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })

    const result = await batchApprove(['lbl_1'])
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
      approvedCount: 0,
      failedIds: [],
    })
  })

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it('returns error when label list is empty', async () => {
    mockSpecialist()
    const result = await batchApprove([])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: [],
      error: 'No labels provided',
    })
  })

  it('returns error when more than 100 labels provided', async () => {
    mockSpecialist()
    const ids = Array.from({ length: 101 }, () => nanoid())
    const result = await batchApprove(ids)
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: [],
      error: 'Maximum 100 labels per batch',
    })
  })

  // -------------------------------------------------------------------------
  // Success case
  // -------------------------------------------------------------------------

  it('approves a valid label and creates audit trail', async () => {
    const session = mockSpecialist()
    const labelId = 'lbl_approve1'
    setupApprovableLabel(labelId)

    const result = await batchApprove([labelId])

    expect(result).toEqual({
      success: true,
      approvedCount: 1,
      failedIds: [],
    })

    expect(mocks.insertStatusOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId,
        specialistId: session.user.id,
        previousStatus: 'pending_review',
        newStatus: 'approved',
        reasonCode: 'batch_approved',
      }),
    )

    expect(mocks.updateLabelStatus).toHaveBeenCalledWith(labelId, {
      status: 'approved',
    })

    expect(mocks.updateTag).toHaveBeenCalledWith('labels')
    expect(mocks.updateTag).toHaveBeenCalledWith('sla-metrics')
  })

  // -------------------------------------------------------------------------
  // Failure: label not found
  // -------------------------------------------------------------------------

  it('marks label as failed when not found', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(null)

    const result = await batchApprove(['lbl_missing'])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: ['lbl_missing'],
    })
  })

  // -------------------------------------------------------------------------
  // Failure: wrong status
  // -------------------------------------------------------------------------

  it('marks label as failed when status is not pending_review', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ id: 'lbl_wrong', status: 'approved' }),
    )

    const result = await batchApprove(['lbl_wrong'])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: ['lbl_wrong'],
    })
  })

  // -------------------------------------------------------------------------
  // Failure: confidence below threshold
  // -------------------------------------------------------------------------

  it('marks label as failed when confidence is below threshold', async () => {
    mockSpecialist()
    mocks.getApprovalThreshold.mockResolvedValue(90)
    mocks.getLabelById.mockResolvedValue(
      createLabel({
        id: 'lbl_lowconf',
        status: 'pending_review',
        overallConfidence: '75',
      }),
    )

    const result = await batchApprove(['lbl_lowconf'])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: ['lbl_lowconf'],
    })
  })

  // -------------------------------------------------------------------------
  // Failure: validation items not all match
  // -------------------------------------------------------------------------

  it('marks label as failed when validation items have mismatches', async () => {
    mockSpecialist()
    const labelId = 'lbl_mismatch'
    const label = createLabel({
      id: labelId,
      status: 'pending_review',
      overallConfidence: '95',
    })
    const items = [
      createValidationItem({ status: 'match' }),
      createValidationItem({ status: 'mismatch' }),
    ]

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getCurrentValidationItems.mockResolvedValue(items)

    const result = await batchApprove([labelId])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: [labelId],
    })
  })

  // -------------------------------------------------------------------------
  // Failure: no validation items (empty array)
  // -------------------------------------------------------------------------

  it('marks label as failed when no validation items exist', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({
        id: 'lbl_noresult',
        status: 'pending_review',
        overallConfidence: '95',
      }),
    )
    mocks.getCurrentValidationItems.mockResolvedValue([])

    const result = await batchApprove(['lbl_noresult'])
    expect(result).toEqual({
      success: false,
      approvedCount: 0,
      failedIds: ['lbl_noresult'],
    })
  })

  // -------------------------------------------------------------------------
  // Partial failures in a batch
  // -------------------------------------------------------------------------

  it('handles mixed success and failure in a batch', async () => {
    mockSpecialist()
    const goodId = 'lbl_good'
    const badId = 'lbl_bad'

    // Good label: approvable
    const goodLabel = createLabel({
      id: goodId,
      status: 'pending_review',
      overallConfidence: '95',
    })
    const goodItems = [createValidationItem({ status: 'match' })]

    // Bad label: not found
    mocks.getLabelById.mockImplementation((id: string) => {
      if (id === goodId) return goodLabel
      return null
    })
    mocks.getCurrentValidationItems.mockImplementation((id: string) => {
      if (id === goodId) return goodItems
      return []
    })

    const result = await batchApprove([goodId, badId])
    expect(result.approvedCount).toBe(1)
    expect(result.failedIds).toEqual([badId])
    expect(result.success).toBe(false) // because failedIds.length > 0
  })

  // -------------------------------------------------------------------------
  // Concurrency
  // -------------------------------------------------------------------------

  it('processes labels concurrently with p-limit(5)', async () => {
    mockSpecialist()
    const labelIds = Array.from({ length: 10 }, (_, i) => `lbl_${i}`)

    // All labels: not found (simplest case for concurrency test)
    mocks.getLabelById.mockResolvedValue(null)

    const result = await batchApprove(labelIds)
    expect(result.failedIds).toHaveLength(10)
    // All 10 labels should have been queried
    expect(mocks.getLabelById).toHaveBeenCalledTimes(10)
  })

  // -------------------------------------------------------------------------
  // DB error during approval
  // -------------------------------------------------------------------------

  it('catches per-label errors and pushes to failedIds', async () => {
    mockSpecialist()
    const labelId = 'lbl_dberror'
    const label = createLabel({
      id: labelId,
      status: 'pending_review',
      overallConfidence: '95',
    })
    const items = [createValidationItem({ status: 'match' })]

    mocks.getLabelById.mockResolvedValue(label)
    mocks.getCurrentValidationItems.mockResolvedValue(items)
    mocks.insertStatusOverride.mockRejectedValue(new Error('DB write failed'))

    const result = await batchApprove([labelId])
    expect(result.approvedCount).toBe(0)
    expect(result.failedIds).toEqual([labelId])
  })
})
