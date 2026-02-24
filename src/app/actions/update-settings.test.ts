import { createSession } from '@/test/factories'
import type { StrictnessLevel } from '@/lib/settings/get-settings'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  getSession: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('next/cache', () => ({ updateTag: mocks.updateTag }))
vi.mock('@/lib/auth/get-session', () => ({ getSession: mocks.getSession }))
vi.mock('@/db', () => ({ db: mocks.db }))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  updateConfidenceThreshold,
  updateFieldStrictness,
  updateSLATargets,
} from './update-settings'

// ---------------------------------------------------------------------------
// Chain builder
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

let selectChain: ReturnType<typeof makeChain>
let insertChain: ReturnType<typeof makeChain>
let updateChain: ReturnType<typeof makeChain>

function setupDb(selectRows: unknown[] = []) {
  selectChain = makeChain(selectRows)
  insertChain = makeChain([])
  updateChain = makeChain([])
  mocks.db.select = vi.fn().mockReturnValue(selectChain)
  mocks.db.insert = vi.fn().mockReturnValue(insertChain)
  mocks.db.update = vi.fn().mockReturnValue(updateChain)
}

// ---------------------------------------------------------------------------
// Tests: updateConfidenceThreshold
// ---------------------------------------------------------------------------

describe('updateConfidenceThreshold', () => {
  beforeEach(() => setupDb())

  it('returns error when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await updateConfidenceThreshold(50)
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.getSession.mockResolvedValue(createSession({ role: 'applicant' }))
    const result = await updateConfidenceThreshold(50)
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  it('returns error when threshold is below 0', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const result = await updateConfidenceThreshold(-1)
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain('between 0 and 100')
  })

  it('returns error when threshold is above 100', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const result = await updateConfidenceThreshold(101)
    expect(result.success).toBe(false)
  })

  it('inserts new setting when none exists', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([]) // no existing setting

    const result = await updateConfidenceThreshold(75)
    expect(result).toEqual({ success: true })
    expect(mocks.db.insert).toHaveBeenCalled()
    expect(mocks.updateTag).toHaveBeenCalledWith('settings')
  })

  it('updates existing setting', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([{ id: 'setting_1' }]) // existing setting found

    const result = await updateConfidenceThreshold(80)
    expect(result).toEqual({ success: true })
    expect(mocks.db.update).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: updateFieldStrictness
// ---------------------------------------------------------------------------

describe('updateFieldStrictness', () => {
  beforeEach(() => setupDb())

  it('returns error when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await updateFieldStrictness({ brand_name: 'strict' })
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.getSession.mockResolvedValue(createSession({ role: 'applicant' }))
    const result = await updateFieldStrictness({ brand_name: 'strict' })
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  it('returns error for invalid strictness value', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    // Intentionally passing invalid value to test runtime validation
    const result = await updateFieldStrictness({
      brand_name: 'invalid_value' as StrictnessLevel,
    })
    expect(result.success).toBe(false)
    expect((result as { error: string }).error).toContain(
      'strict, moderate, or lenient',
    )
  })

  it('succeeds with valid strictness values', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([]) // no existing setting

    const result = await updateFieldStrictness({
      brand_name: 'strict',
      alcohol_content: 'lenient',
      health_warning: 'moderate',
    })
    expect(result).toEqual({ success: true })
    expect(mocks.updateTag).toHaveBeenCalledWith('settings')
  })
})

// ---------------------------------------------------------------------------
// Tests: updateSLATargets
// ---------------------------------------------------------------------------

describe('updateSLATargets', () => {
  const validTargets = {
    reviewResponseHours: 24,
    totalTurnaroundHours: 48,
    autoApprovalRateTarget: 80,
    maxQueueDepth: 100,
  }

  beforeEach(() => setupDb())

  it('returns error when unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await updateSLATargets(validTargets)
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.getSession.mockResolvedValue(createSession({ role: 'applicant' }))
    const result = await updateSLATargets(validTargets)
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  it('returns error for out-of-range reviewResponseHours', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const result = await updateSLATargets({
      ...validTargets,
      reviewResponseHours: 0,
    })
    expect(result.success).toBe(false)
  })

  it('returns error for out-of-range maxQueueDepth', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    const result = await updateSLATargets({
      ...validTargets,
      maxQueueDepth: 1001,
    })
    expect(result.success).toBe(false)
  })

  it('succeeds with valid SLA targets', async () => {
    mocks.getSession.mockResolvedValue(createSession())
    setupDb([]) // no existing setting

    const result = await updateSLATargets(validTargets)
    expect(result).toEqual({ success: true })
    expect(mocks.updateTag).toHaveBeenCalledWith('settings')
  })
})
