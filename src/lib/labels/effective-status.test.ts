import {
  getEffectiveStatus,
  getDeadlineInfo,
} from '@/lib/labels/effective-status'

// ---------------------------------------------------------------------------
// getEffectiveStatus
// ---------------------------------------------------------------------------

describe('getEffectiveStatus', () => {
  it('returns unchanged status when no deadline is set', () => {
    const result = getEffectiveStatus({
      status: 'needs_correction',
      correctionDeadline: null,
      deadlineExpired: false,
    })
    expect(result).toBe('needs_correction')
  })

  it('returns unchanged status when deadline is in the future', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = getEffectiveStatus({
      status: 'needs_correction',
      correctionDeadline: future,
      deadlineExpired: false,
    })
    expect(result).toBe('needs_correction')
  })

  it('returns rejected when needs_correction deadline has passed', () => {
    const past = new Date(Date.now() - 1000)
    const result = getEffectiveStatus({
      status: 'needs_correction',
      correctionDeadline: past,
      deadlineExpired: false,
    })
    expect(result).toBe('rejected')
  })

  it('returns needs_correction when conditionally_approved deadline has passed', () => {
    const past = new Date(Date.now() - 1000)
    const result = getEffectiveStatus({
      status: 'conditionally_approved',
      correctionDeadline: past,
      deadlineExpired: false,
    })
    expect(result).toBe('needs_correction')
  })

  it('returns approved unchanged regardless of deadline', () => {
    const past = new Date(Date.now() - 1000)
    const result = getEffectiveStatus({
      status: 'approved',
      correctionDeadline: past,
      deadlineExpired: false,
    })
    expect(result).toBe('approved')
  })

  it('returns rejected unchanged regardless of deadline', () => {
    const past = new Date(Date.now() - 1000)
    const result = getEffectiveStatus({
      status: 'rejected',
      correctionDeadline: past,
      deadlineExpired: false,
    })
    expect(result).toBe('rejected')
  })

  it('uses deadlineExpired flag even when deadline date is in the future', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = getEffectiveStatus({
      status: 'needs_correction',
      correctionDeadline: future,
      deadlineExpired: true,
    })
    expect(result).toBe('rejected')
  })

  it('passes through pending status unchanged', () => {
    const result = getEffectiveStatus({
      status: 'pending',
      correctionDeadline: null,
      deadlineExpired: false,
    })
    expect(result).toBe('pending')
  })

  it('passes through processing status unchanged (no updatedAt)', () => {
    const result = getEffectiveStatus({
      status: 'processing',
      correctionDeadline: null,
      deadlineExpired: false,
    })
    expect(result).toBe('processing')
  })

  it('passes through processing status when recently updated', () => {
    const result = getEffectiveStatus({
      status: 'processing',
      correctionDeadline: null,
      deadlineExpired: false,
      updatedAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
    })
    expect(result).toBe('processing')
  })

  it('returns pending_review for stale processing (>5 min)', () => {
    const result = getEffectiveStatus({
      status: 'processing',
      correctionDeadline: null,
      deadlineExpired: false,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    })
    expect(result).toBe('pending_review')
  })

  it('returns pending_review for stale processing at exactly 5 min boundary', () => {
    const result = getEffectiveStatus({
      status: 'processing',
      correctionDeadline: null,
      deadlineExpired: false,
      updatedAt: new Date(Date.now() - 5 * 60 * 1000 - 1), // just past 5 min
    })
    expect(result).toBe('pending_review')
  })
})

// ---------------------------------------------------------------------------
// getDeadlineInfo
// ---------------------------------------------------------------------------

describe('getDeadlineInfo', () => {
  it('returns null when deadline is null', () => {
    expect(getDeadlineInfo(null)).toBeNull()
  })

  it('returns expired with 0 days remaining for a past deadline', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const info = getDeadlineInfo(past)
    expect(info).not.toBeNull()
    expect(info!.urgency).toBe('expired')
    expect(info!.daysRemaining).toBe(0)
  })

  it('returns red urgency for deadline less than 24 hours away', () => {
    const soon = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
    const info = getDeadlineInfo(soon)
    expect(info).not.toBeNull()
    expect(info!.urgency).toBe('red')
    expect(info!.daysRemaining).toBe(1)
  })

  it('returns amber urgency for 1-7 days remaining', () => {
    const fiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const info = getDeadlineInfo(fiveDays)
    expect(info).not.toBeNull()
    expect(info!.urgency).toBe('amber')
    expect(info!.daysRemaining).toBeGreaterThanOrEqual(4)
    expect(info!.daysRemaining).toBeLessThanOrEqual(6)
  })

  it('returns green urgency for more than 7 days remaining', () => {
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const info = getDeadlineInfo(twoWeeks)
    expect(info).not.toBeNull()
    expect(info!.urgency).toBe('green')
    expect(info!.daysRemaining).toBeGreaterThanOrEqual(13)
  })

  it('returns amber urgency for exactly 7 days remaining', () => {
    // 7 days from now, minus a small epsilon so Math.ceil gives 7
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 - 1000)
    const info = getDeadlineInfo(sevenDays)
    expect(info).not.toBeNull()
    expect(info!.urgency).toBe('amber')
  })
})
