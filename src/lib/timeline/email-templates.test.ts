import {
  generateStatusEmail,
  generateOverrideEmail,
} from '@/lib/timeline/email-templates'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const appData = { serialNumber: 'SN-12345', brandName: 'Old Tom Reserve' }
const applicant = {
  companyName: 'Old Tom Distillery',
  contactName: 'Thomas Blackwell',
  contactEmail: 'labeling@oldtomdistillery.com',
}
const matchingItems = [
  {
    fieldName: 'brand_name',
    status: 'match',
    expectedValue: 'Old Tom Reserve',
    extractedValue: 'Old Tom Reserve',
  },
]
const mismatchItems = [
  {
    fieldName: 'alcohol_content',
    status: 'mismatch',
    expectedValue: '40%',
    extractedValue: '38%',
  },
  {
    fieldName: 'net_contents',
    status: 'not_found',
    expectedValue: '750 mL',
    extractedValue: '',
  },
]

// ---------------------------------------------------------------------------
// generateStatusEmail
// ---------------------------------------------------------------------------

describe('generateStatusEmail', () => {
  it('generates approved email with serial number in subject', () => {
    const email = generateStatusEmail(
      'approved',
      appData,
      applicant,
      matchingItems,
      null,
    )
    expect(email.subject).toBe('COLA Application Approved — SN-12345')
    expect(email.body).toContain('Dear Thomas Blackwell')
    expect(email.body).toContain('approved')
    expect(email.body).toContain('Old Tom Reserve')
    expect(email.body).toContain('No further action is required')
    expect(email.fieldIssues).toBeUndefined()
  })

  it('generates conditionally_approved email with deadline and issues', () => {
    const deadline = new Date('2026-02-20T12:00:00Z')
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(deadline)
    const email = generateStatusEmail(
      'conditionally_approved',
      appData,
      applicant,
      mismatchItems,
      deadline,
    )
    expect(email.subject).toContain('Conditionally Approved')
    expect(email.subject).toContain('SN-12345')
    expect(email.body).toContain(formatted)
    expect(email.body).toContain('Alcohol Content')
    expect(email.fieldIssues).toHaveLength(2)
  })

  it('generates needs_correction email with field issues', () => {
    const deadline = new Date('2026-03-10T12:00:00Z')
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(deadline)
    const email = generateStatusEmail(
      'needs_correction',
      appData,
      applicant,
      mismatchItems,
      deadline,
    )
    expect(email.subject).toBe(
      'COLA Application Requires Correction — SN-12345',
    )
    expect(email.body).toContain(formatted)
    expect(email.body).toContain('Non-compliant fields')
    expect(email.body).toContain('MISSING')
    expect(email.fieldIssues).toHaveLength(2)
  })

  it('generates rejected email', () => {
    const email = generateStatusEmail(
      'rejected',
      appData,
      applicant,
      mismatchItems,
      null,
    )
    expect(email.subject).toContain('REJECTED')
    expect(email.subject).toContain('SN-12345')
    expect(email.body).toContain('does not comply')
    expect(email.body).toContain('submit a new application')
  })

  it('handles null brandName gracefully', () => {
    const email = generateStatusEmail(
      'approved',
      { serialNumber: null, brandName: null },
      applicant,
      matchingItems,
      null,
    )
    expect(email.body).toContain('"Unknown"')
    expect(email.subject).toBe('COLA Application Approved')
  })

  it('handles null appData and applicant', () => {
    const email = generateStatusEmail(
      'approved',
      null,
      null,
      matchingItems,
      null,
    )
    expect(email.body).toContain('Dear Applicant')
    expect(email.to).toContain('applicant@example.com')
    expect(email.body).toContain('"Unknown"')
  })

  it('sets correct from and to addresses', () => {
    const email = generateStatusEmail(
      'approved',
      appData,
      applicant,
      matchingItems,
      null,
    )
    expect(email.from).toBe('TTB Label Compliance <noreply@ttb.gov>')
    expect(email.to).toBe('Thomas Blackwell <labeling@oldtomdistillery.com>')
  })

  it('uses fallback deadline text when no deadline is provided for conditionally_approved', () => {
    const email = generateStatusEmail(
      'conditionally_approved',
      appData,
      applicant,
      mismatchItems,
      null,
    )
    expect(email.body).toContain('7 days from this notice')
  })
})

// ---------------------------------------------------------------------------
// generateOverrideEmail
// ---------------------------------------------------------------------------

describe('generateOverrideEmail', () => {
  it('includes previous and new status labels', () => {
    const email = generateOverrideEmail(
      {
        previousStatus: 'needs_correction',
        newStatus: 'approved',
        justification: 'Corrections received and verified',
        specialistName: 'Sarah Chen',
      },
      appData,
      applicant,
      null,
    )
    expect(email.subject).toContain('APPROVED')
    expect(email.subject).toContain('SN-12345')
    expect(email.body).toContain('Previous status: NEEDS CORRECTION')
    expect(email.body).toContain('Updated status: APPROVED')
    expect(email.body).toContain('Corrections received and verified')
  })

  it('includes deadline note for needs_correction new status', () => {
    const deadline = new Date('2026-03-15T12:00:00Z')
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(deadline)
    const email = generateOverrideEmail(
      {
        previousStatus: 'approved',
        newStatus: 'needs_correction',
        justification: 'Additional issues found',
        specialistName: null,
      },
      appData,
      applicant,
      deadline,
    )
    expect(email.body).toContain(formatted)
    expect(email.body).toContain('deadline for corrections')
  })

  it('does not include deadline note for approved new status', () => {
    const deadline = new Date('2026-03-15T00:00:00Z')
    const email = generateOverrideEmail(
      {
        previousStatus: 'needs_correction',
        newStatus: 'approved',
        justification: 'Corrections accepted',
        specialistName: null,
      },
      appData,
      applicant,
      deadline,
    )
    expect(email.body).not.toContain('deadline for corrections')
  })

  it('handles null appData and applicant', () => {
    const email = generateOverrideEmail(
      {
        previousStatus: 'approved',
        newStatus: 'rejected',
        justification: 'Compliance issue found',
        specialistName: null,
      },
      null,
      null,
      null,
    )
    expect(email.body).toContain('Dear Applicant')
    expect(email.body).toContain('"Unknown"')
    expect(email.to).toContain('applicant@example.com')
  })
})
