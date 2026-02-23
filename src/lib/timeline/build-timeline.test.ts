import { buildTimeline } from '@/lib/timeline/build-timeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    label: {
      id: 'lbl_test1',
      status: 'approved',
      correctionDeadline: null,
      createdAt: new Date('2026-01-10T10:00:00Z'),
    },
    effectiveStatus: 'approved',
    appData: { serialNumber: 'SN-001', brandName: 'Old Tom' },
    applicant: {
      companyName: 'Old Tom Distillery',
      contactName: 'Thomas Blackwell',
      contactEmail: 'labeling@oldtomdistillery.com',
    },
    validationResult: { createdAt: new Date('2026-01-10T10:00:05Z') },
    validationItems: [
      {
        fieldName: 'brand_name',
        status: 'match',
        expectedValue: 'Old Tom',
        extractedValue: 'Old Tom',
      },
      {
        fieldName: 'health_warning',
        status: 'match',
        expectedValue: 'GOVERNMENT WARNING...',
        extractedValue: 'GOVERNMENT WARNING...',
      },
    ],
    humanReviews: [],
    overrides: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTimeline', () => {
  it('always includes a submitted event', () => {
    const events = buildTimeline(makeInput())
    const submitted = events.find((e) => e.type === 'submitted')
    expect(submitted).toBeDefined()
    expect(submitted!.title).toBe('Application Submitted')
    expect(submitted!.description).toContain('Old Tom')
  })

  it('includes submitted event with generic description when brandName is null', () => {
    const events = buildTimeline(
      makeInput({ appData: { serialNumber: null, brandName: null } }),
    )
    const submitted = events.find((e) => e.type === 'submitted')
    expect(submitted!.description).toBe(
      'COLA application received for processing',
    )
  })

  it('includes processing_complete event when validationResult exists', () => {
    const events = buildTimeline(makeInput())
    const processing = events.find((e) => e.type === 'processing_complete')
    expect(processing).toBeDefined()
    expect(processing!.description).toContain('2 fields')
  })

  it('does not include processing_complete when validationResult is null', () => {
    const events = buildTimeline(makeInput({ validationResult: null }))
    const processing = events.find((e) => e.type === 'processing_complete')
    expect(processing).toBeUndefined()
  })

  it('includes status_determined event for applicant-facing statuses', () => {
    const events = buildTimeline(makeInput())
    const status = events.find((e) => e.type === 'status_determined')
    expect(status).toBeDefined()
    expect(status!.title).toContain('Approved')
  })

  it('does not include status_determined for pending or processing status', () => {
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'processing',
          correctionDeadline: null,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'processing',
      }),
    )
    const status = events.find((e) => e.type === 'status_determined')
    expect(status).toBeUndefined()
  })

  it('includes email_sent for applicant-facing statuses', () => {
    const events = buildTimeline(makeInput())
    const email = events.find((e) => e.type === 'email_sent')
    expect(email).toBeDefined()
    expect(email!.email).toBeDefined()
    expect(email!.email!.subject).toContain('Approved')
  })

  it('does not include email_sent for pending_review status', () => {
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'pending_review',
          correctionDeadline: null,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'pending_review',
      }),
    )
    const email = events.find((e) => e.type === 'email_sent')
    expect(email).toBeUndefined()
  })

  it('groups human reviews within a 60-second window by same specialist', () => {
    const baseTime = new Date('2026-01-10T12:00:00Z')
    const events = buildTimeline(
      makeInput({
        humanReviews: [
          {
            id: 'rev_1',
            fieldName: 'brand_name',
            originalStatus: 'mismatch',
            resolvedStatus: 'match',
            reviewerNotes: null,
            reviewedAt: baseTime,
            specialistName: 'Sarah Chen',
          },
          {
            id: 'rev_2',
            fieldName: 'alcohol_content',
            originalStatus: 'mismatch',
            resolvedStatus: 'match',
            reviewerNotes: null,
            reviewedAt: new Date(baseTime.getTime() + 30_000), // +30s
            specialistName: 'Sarah Chen',
          },
        ],
      }),
    )
    const reviews = events.filter((e) => e.type === 'specialist_review')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].description).toContain('2 fields')
    expect(reviews[0].actorName).toBe('Sarah Chen')
  })

  it('separates reviews from different specialists into distinct events', () => {
    const baseTime = new Date('2026-01-10T12:00:00Z')
    const events = buildTimeline(
      makeInput({
        humanReviews: [
          {
            id: 'rev_1',
            fieldName: 'brand_name',
            originalStatus: 'mismatch',
            resolvedStatus: 'match',
            reviewerNotes: null,
            reviewedAt: baseTime,
            specialistName: 'Sarah Chen',
          },
          {
            id: 'rev_2',
            fieldName: 'alcohol_content',
            originalStatus: 'mismatch',
            resolvedStatus: 'match',
            reviewerNotes: null,
            reviewedAt: new Date(baseTime.getTime() + 10_000),
            specialistName: 'John Doe',
          },
        ],
      }),
    )
    const reviews = events.filter((e) => e.type === 'specialist_review')
    expect(reviews).toHaveLength(2)
  })

  it('includes status_override events with justification', () => {
    const events = buildTimeline(
      makeInput({
        overrides: [
          {
            id: 'ovr_1',
            previousStatus: 'needs_correction',
            newStatus: 'approved',
            justification: 'Applicant submitted corrections',
            reasonCode: 'corrected',
            createdAt: new Date('2026-01-12T09:00:00Z'),
            specialistName: 'Sarah Chen',
          },
        ],
      }),
    )
    const override = events.find((e) => e.type === 'status_override')
    expect(override).toBeDefined()
    expect(override!.title).toContain('Needs Correction')
    expect(override!.title).toContain('Approved')
    expect(override!.description).toBe('Applicant submitted corrections')
    expect(override!.actorName).toBe('Sarah Chen')
  })

  it('includes override email for applicant-facing new status', () => {
    const events = buildTimeline(
      makeInput({
        overrides: [
          {
            id: 'ovr_1',
            previousStatus: 'needs_correction',
            newStatus: 'approved',
            justification: 'Corrections accepted',
            reasonCode: null,
            createdAt: new Date('2026-01-12T09:00:00Z'),
            specialistName: 'Sarah Chen',
          },
        ],
      }),
    )
    const overrideEmail = events.find((e) => e.type === 'override_email_sent')
    expect(overrideEmail).toBeDefined()
    expect(overrideEmail!.email!.subject).toContain('APPROVED')
  })

  it('includes deadline_warning for active correction deadline', () => {
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'needs_correction',
          correctionDeadline: futureDeadline,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'needs_correction',
      }),
    )
    const deadline = events.find((e) => e.type === 'deadline_warning')
    expect(deadline).toBeDefined()
    expect(deadline!.description).toContain('rejected')
  })

  it('does not include deadline_warning when deadline has already passed', () => {
    const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'needs_correction',
          correctionDeadline: pastDeadline,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'needs_correction',
      }),
    )
    const deadline = events.find((e) => e.type === 'deadline_warning')
    expect(deadline).toBeUndefined()
  })

  it('does not include deadline_warning for approved status', () => {
    const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'approved',
          correctionDeadline: futureDeadline,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'approved',
      }),
    )
    const deadline = events.find((e) => e.type === 'deadline_warning')
    expect(deadline).toBeUndefined()
  })

  it('sorts events in reverse chronological order', () => {
    const events = buildTimeline(makeInput())
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
        events[i].timestamp.getTime(),
      )
    }
  })

  it('produces minimal output for a bare-minimum input', () => {
    const events = buildTimeline({
      label: {
        id: 'lbl_min',
        status: 'pending',
        correctionDeadline: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      effectiveStatus: 'pending',
      appData: null,
      applicant: null,
      validationResult: null,
      validationItems: [],
      humanReviews: [],
      overrides: [],
    })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('submitted')
  })

  it('includes deadline_warning for conditionally_approved with future deadline', () => {
    const futureDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const events = buildTimeline(
      makeInput({
        label: {
          id: 'lbl_test1',
          status: 'conditionally_approved',
          correctionDeadline: futureDeadline,
          createdAt: new Date('2026-01-10T10:00:00Z'),
        },
        effectiveStatus: 'conditionally_approved',
      }),
    )
    const deadline = events.find((e) => e.type === 'deadline_warning')
    expect(deadline).toBeDefined()
    expect(deadline!.description).toContain('Needs Correction')
  })
})
