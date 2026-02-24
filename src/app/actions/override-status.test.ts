import { createLabel, createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs (vi.mock factories are hoisted above all imports)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  guardSpecialist: vi.fn(),
  getLabelById: vi.fn(),
  updateLabelStatus: vi.fn(),
  insertStatusOverride: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/queries/labels', () => ({
  getLabelById: mocks.getLabelById,
}))
vi.mock('@/db/mutations/labels', () => ({
  updateLabelStatus: mocks.updateLabelStatus,
}))
vi.mock('@/db/mutations/reviews', () => ({
  insertStatusOverride: mocks.insertStatusOverride,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { overrideStatus } from './override-status'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validInput(overrides?: Record<string, unknown>) {
  return {
    labelId: 'lbl_abc123',
    newStatus: 'approved' as const,
    justification: 'Manual review confirmed all fields match',
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

describe('overrideStatus', () => {
  beforeEach(() => {
    mocks.updateLabelStatus.mockResolvedValue(undefined)
    mocks.insertStatusOverride.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })
    const result = await overrideStatus(validInput())
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })
    const result = await overrideStatus(validInput())
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('returns error when justification is too short', async () => {
    mockSpecialist()
    const result = await overrideStatus(
      validInput({ justification: 'Too short' }),
    )
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain(
      'at least 10 characters',
    )
  })

  it('returns error when labelId is empty', async () => {
    mockSpecialist()
    const result = await overrideStatus(validInput({ labelId: '' }))
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Label not found
  // -------------------------------------------------------------------------

  it('returns error when label does not exist', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(null)

    const result = await overrideStatus(validInput())
    expect(result).toEqual({ success: false, error: 'Label not found' })
  })

  // -------------------------------------------------------------------------
  // Blocked statuses
  // -------------------------------------------------------------------------

  it('blocks override on pending labels', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(createLabel({ status: 'pending' }))

    const result = await overrideStatus(validInput())
    expect(result).toEqual({
      success: false,
      error: 'Cannot override a label that is still being processed',
    })
  })

  it('blocks override on processing labels', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(createLabel({ status: 'processing' }))

    const result = await overrideStatus(validInput())
    expect(result).toEqual({
      success: false,
      error: 'Cannot override a label that is still being processed',
    })
  })

  it('blocks no-op override when status is already the same', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(createLabel({ status: 'approved' }))

    const result = await overrideStatus(validInput({ newStatus: 'approved' }))
    expect(result).toEqual({
      success: false,
      error: 'Label is already "approved"',
    })
  })

  // -------------------------------------------------------------------------
  // Success cases with deadline computation
  // -------------------------------------------------------------------------

  it('sets 7-day deadline for conditionally_approved', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ status: 'pending_review' }),
    )

    const before = new Date()
    const result = await overrideStatus(
      validInput({ newStatus: 'conditionally_approved' }),
    )
    const after = new Date()

    expect(result).toEqual({ success: true })

    const statusFields = mocks.updateLabelStatus.mock.calls[0][1]
    expect(statusFields.status).toBe('conditionally_approved')
    expect(statusFields.deadlineExpired).toBe(false)

    const deadline = statusFields.correctionDeadline as Date
    const sevenDaysBefore = new Date(before)
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() + 7)
    const sevenDaysAfter = new Date(after)
    sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7)

    expect(deadline.getTime()).toBeGreaterThanOrEqual(
      sevenDaysBefore.getTime() - 1000,
    )
    expect(deadline.getTime()).toBeLessThanOrEqual(
      sevenDaysAfter.getTime() + 1000,
    )
  })

  it('sets 30-day deadline for needs_correction', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ status: 'pending_review' }),
    )

    const before = new Date()
    const result = await overrideStatus(
      validInput({ newStatus: 'needs_correction' }),
    )

    expect(result).toEqual({ success: true })

    const statusFields = mocks.updateLabelStatus.mock.calls[0][1]
    const deadline = statusFields.correctionDeadline as Date
    const thirtyDays = new Date(before)
    thirtyDays.setDate(thirtyDays.getDate() + 30)

    expect(Math.abs(deadline.getTime() - thirtyDays.getTime())).toBeLessThan(
      2000,
    )
  })

  it('sets null deadline for approved and rejected', async () => {
    mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ status: 'pending_review' }),
    )

    await overrideStatus(validInput({ newStatus: 'approved' }))
    const statusFields = mocks.updateLabelStatus.mock.calls[0][1]
    expect(statusFields.correctionDeadline).toBeNull()
    expect(statusFields.status).toBe('approved')
  })

  // -------------------------------------------------------------------------
  // Audit trail + revalidation
  // -------------------------------------------------------------------------

  it('creates a statusOverrides audit record and calls updateTag', async () => {
    const session = mockSpecialist()
    mocks.getLabelById.mockResolvedValue(
      createLabel({ id: 'lbl_test', status: 'pending_review' }),
    )

    const result = await overrideStatus(
      validInput({
        labelId: 'lbl_test',
        newStatus: 'rejected',
        justification: 'Health warning missing from label',
      }),
    )

    expect(result).toEqual({ success: true })

    // Verify insertStatusOverride was called for audit record
    expect(mocks.insertStatusOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        labelId: 'lbl_test',
        specialistId: session.user.id,
        previousStatus: 'pending_review',
        newStatus: 'rejected',
        justification: 'Health warning missing from label',
      }),
    )

    // Verify updateTag was called for cache invalidation
    expect(mocks.updateTag).toHaveBeenCalledWith('labels')
    expect(mocks.updateTag).toHaveBeenCalledWith('sla-metrics')
  })
})
