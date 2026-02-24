import { createLabel, createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs (vi.mock factories are hoisted above all imports)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth/get-session', () => ({ getSession: mocks.getSession }))
vi.mock('@/db', () => ({ db: mocks.db }))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { overrideStatus } from './override-status'

// ---------------------------------------------------------------------------
// Chain builder — creates a fresh chainable DB stub that resolves to `rows`
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

// Track the last chains installed so tests can inspect call args
let insertChain: ReturnType<typeof makeChain>
let updateChain: ReturnType<typeof makeChain>

function setupDb(selectRows: unknown[] = []) {
  const selectChain = makeChain(selectRows)
  insertChain = makeChain([])
  updateChain = makeChain([])

  mocks.db.select = vi.fn().mockReturnValue(selectChain)
  mocks.db.insert = vi.fn().mockReturnValue(insertChain)
  mocks.db.update = vi.fn().mockReturnValue(updateChain)
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('overrideStatus', () => {
  beforeEach(() => {
    setupDb()
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await overrideStatus(validInput())
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.getSession.mockResolvedValue(createSession({ role: 'applicant' }))
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
    mocks.getSession.mockResolvedValue(createSession())
    const result = await overrideStatus(
      validInput({ justification: 'Too short' }),
    )
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain(
      'at least 10 characters',
    )
  })

  it('returns error when labelId is empty', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const result = await overrideStatus(validInput({ labelId: '' }))
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Label not found
  // -------------------------------------------------------------------------

  it('returns error when label does not exist', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([]) // empty result

    const result = await overrideStatus(validInput())
    expect(result).toEqual({ success: false, error: 'Label not found' })
  })

  // -------------------------------------------------------------------------
  // Blocked statuses
  // -------------------------------------------------------------------------

  it('blocks override on pending labels', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'pending' })])

    const result = await overrideStatus(validInput())
    expect(result).toEqual({
      success: false,
      error: 'Cannot override a label that is still being processed',
    })
  })

  it('blocks override on processing labels', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'processing' })])

    const result = await overrideStatus(validInput())
    expect(result).toEqual({
      success: false,
      error: 'Cannot override a label that is still being processed',
    })
  })

  it('blocks no-op override when status is already the same', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'approved' })])

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
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'pending_review' })])

    const before = new Date()
    const result = await overrideStatus(
      validInput({ newStatus: 'conditionally_approved' }),
    )
    const after = new Date()

    expect(result).toEqual({ success: true })

    const setCall = updateChain.set.mock.calls[0]?.[0]
    expect(setCall.status).toBe('conditionally_approved')
    expect(setCall.deadlineExpired).toBe(false)

    const deadline = setCall.correctionDeadline as Date
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
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'pending_review' })])

    const before = new Date()
    const result = await overrideStatus(
      validInput({ newStatus: 'needs_correction' }),
    )

    expect(result).toEqual({ success: true })

    const setCall = updateChain.set.mock.calls[0]?.[0]
    const deadline = setCall.correctionDeadline as Date
    const thirtyDays = new Date(before)
    thirtyDays.setDate(thirtyDays.getDate() + 30)

    expect(Math.abs(deadline.getTime() - thirtyDays.getTime())).toBeLessThan(
      2000,
    )
  })

  it('sets null deadline for approved and rejected', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([createLabel({ status: 'pending_review' })])

    await overrideStatus(validInput({ newStatus: 'approved' }))
    const setCall = updateChain.set.mock.calls[0]?.[0]
    expect(setCall.correctionDeadline).toBeNull()
    expect(setCall.status).toBe('approved')
  })

  // -------------------------------------------------------------------------
  // Audit trail + revalidation
  // -------------------------------------------------------------------------

  it('creates a statusOverrides audit record and calls revalidatePath', async () => {
    const session = createSession()
    mocks.getSession.mockResolvedValue(session)
    setupDb([createLabel({ id: 'lbl_test', status: 'pending_review' })])

    const result = await overrideStatus(
      validInput({
        labelId: 'lbl_test',
        newStatus: 'rejected',
        justification: 'Health warning missing from label',
      }),
    )

    expect(result).toEqual({ success: true })

    // Verify insert was called for audit record
    const insertValues = insertChain.values.mock.calls[0]?.[0]
    expect(insertValues).toMatchObject({
      labelId: 'lbl_test',
      specialistId: session.user.id,
      previousStatus: 'pending_review',
      newStatus: 'rejected',
      justification: 'Health warning missing from label',
    })

    // Verify revalidatePath was called
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/labels/lbl_test')
  })
})
