import { createSession } from '@/test/factories'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  guardSpecialist: vi.fn(),
  updateApplicantNotesDb: vi.fn(),
}))

vi.mock('@/lib/auth/action-guards', () => ({
  guardSpecialist: mocks.guardSpecialist,
}))
vi.mock('@/db/mutations/applicants', () => ({
  updateApplicantNotes: mocks.updateApplicantNotesDb,
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { updateApplicantNotes } from './update-applicant-notes'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateApplicantNotes', () => {
  beforeEach(() => {
    mocks.updateApplicantNotesDb.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('returns error when unauthenticated', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Authentication required',
    })
    const result = await updateApplicantNotes('app_123', 'some notes')
    expect(result).toEqual({ success: false, error: 'Authentication required' })
  })

  it('returns error when user is an applicant', async () => {
    mocks.guardSpecialist.mockResolvedValue({
      success: false,
      error: 'Only specialists can perform this action',
    })
    const result = await updateApplicantNotes('app_123', 'some notes')
    expect(result).toEqual({
      success: false,
      error: 'Only specialists can perform this action',
    })
  })

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('returns error when applicantId is empty', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    const result = await updateApplicantNotes('', 'some notes')
    expect(result).toEqual({ success: false, error: 'Invalid input' })
  })

  it('returns error when notes exceed 2000 characters', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    const longNotes = 'a'.repeat(2001)
    const result = await updateApplicantNotes('app_123', longNotes)
    expect(result).toEqual({ success: false, error: 'Invalid input' })
  })

  // -------------------------------------------------------------------------
  // Success cases
  // -------------------------------------------------------------------------

  it('saves notes successfully', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    const result = await updateApplicantNotes('app_123', 'High risk applicant')
    expect(result).toEqual({ success: true })
    expect(mocks.updateApplicantNotesDb).toHaveBeenCalledWith(
      'app_123',
      'High risk applicant',
    )
  })

  it('trims whitespace from notes', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    await updateApplicantNotes('app_123', '  padded notes  ')
    expect(mocks.updateApplicantNotesDb).toHaveBeenCalledWith(
      'app_123',
      'padded notes',
    )
  })

  it('accepts null notes to clear them', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    const result = await updateApplicantNotes('app_123', null)
    expect(result).toEqual({ success: true })
    expect(mocks.updateApplicantNotesDb).toHaveBeenCalledWith('app_123', null)
  })

  it('converts empty string notes to null', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })

    await updateApplicantNotes('app_123', '')
    expect(mocks.updateApplicantNotesDb).toHaveBeenCalledWith('app_123', null)
  })

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns error when database update fails', async () => {
    const session = createSession()
    mocks.guardSpecialist.mockResolvedValue({ success: true, session })
    mocks.updateApplicantNotesDb.mockRejectedValue(
      new Error('Database connection lost'),
    )

    const result = await updateApplicantNotes('app_123', 'notes')
    expect(result).toEqual({ success: false, error: 'Failed to save notes' })
  })
})
