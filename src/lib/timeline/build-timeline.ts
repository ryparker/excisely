import type { TimelineEvent } from './types'
import { generateStatusEmail, generateOverrideEmail } from './email-templates'

// ---------------------------------------------------------------------------
// Input types — match the shapes already fetched on the label detail page
// ---------------------------------------------------------------------------

interface TimelineLabel {
  id: string
  status: string
  correctionDeadline: Date | null
  createdAt: Date
}

interface TimelineAppData {
  serialNumber: string | null
  brandName: string | null
}

interface TimelineApplicant {
  companyName: string
  contactName: string | null
  contactEmail: string | null
}

interface TimelineValidationResult {
  createdAt: Date
}

interface TimelineValidationItem {
  fieldName: string
  status: string
  expectedValue: string
  extractedValue: string
}

interface TimelineHumanReview {
  id: string
  fieldName: string | null
  originalStatus: string
  resolvedStatus: string
  reviewerNotes: string | null
  reviewedAt: Date
  specialistName: string | null
}

interface TimelineOverride {
  id: string
  previousStatus: string
  newStatus: string
  justification: string
  createdAt: Date
  specialistName: string | null
}

interface BuildTimelineInput {
  label: TimelineLabel
  effectiveStatus: string
  appData: TimelineAppData | null
  applicant: TimelineApplicant | null
  validationResult: TimelineValidationResult | null
  validationItems: TimelineValidationItem[]
  humanReviews: TimelineHumanReview[]
  overrides: TimelineOverride[]
}

// ---------------------------------------------------------------------------
// Applicant-facing statuses (ones that trigger email notifications)
// ---------------------------------------------------------------------------

const APPLICANT_FACING_STATUSES = new Set([
  'approved',
  'conditionally_approved',
  'needs_correction',
  'rejected',
])

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildTimeline(input: BuildTimelineInput): TimelineEvent[] {
  const {
    label,
    effectiveStatus,
    appData,
    applicant,
    validationResult,
    validationItems,
    humanReviews,
    overrides,
  } = input

  const events: TimelineEvent[] = []

  // 1. Submitted
  events.push({
    id: `submitted-${label.id}`,
    type: 'submitted',
    timestamp: label.createdAt,
    title: 'Application Submitted',
    description: appData?.brandName
      ? `COLA application received for "${appData.brandName}"`
      : 'COLA application received for processing',
    status: 'pending',
  })

  // 2. Processing Complete
  if (validationResult) {
    events.push({
      id: `processing-${label.id}`,
      type: 'processing_complete',
      timestamp: validationResult.createdAt,
      title: 'AI Processing Complete',
      description: `Label analyzed — ${validationItems.length} field${validationItems.length === 1 ? '' : 's'} extracted and compared`,
      status: 'processing',
    })
  }

  // 3. Status Determined
  if (
    validationResult &&
    label.status !== 'pending' &&
    label.status !== 'processing'
  ) {
    const statusDeterminedAt = new Date(
      validationResult.createdAt.getTime() + 2000,
    )
    events.push({
      id: `status-${label.id}`,
      type: 'status_determined',
      timestamp: statusDeterminedAt,
      title: `Status: ${formatStatusLabel(label.status)}`,
      description: getStatusDescription(label.status, validationItems),
      status: label.status,
    })
  }

  // 4. Initial email sent (for applicant-facing statuses)
  if (validationResult && APPLICANT_FACING_STATUSES.has(label.status)) {
    const emailSentAt = new Date(validationResult.createdAt.getTime() + 62000) // +~1 min after processing
    const email = generateStatusEmail(
      label.status,
      appData,
      applicant,
      validationItems,
      label.correctionDeadline,
    )
    events.push({
      id: `email-${label.id}`,
      type: 'email_sent',
      timestamp: emailSentAt,
      title: `Notification Sent to Applicant`,
      description: email.subject,
      status: label.status,
      email,
    })
  }

  // 5. Human reviews — group by reviewedAt within 1-min windows
  const groupedReviews = groupReviewsBySession(humanReviews)
  for (const group of groupedReviews) {
    const fieldCount = group.reviews.length
    const fieldNames = group.reviews
      .map((r) => r.fieldName)
      .filter(Boolean)
      .join(', ')

    events.push({
      id: `review-${group.reviews[0].id}`,
      type: 'specialist_review',
      timestamp: group.timestamp,
      title: 'Specialist Review',
      description: `${fieldCount} field${fieldCount === 1 ? '' : 's'} reviewed${fieldNames ? `: ${fieldNames}` : ''}`,
      status: 'pending_review',
      actorName: group.specialistName ?? undefined,
      metadata: group.notes ? { notes: group.notes } : undefined,
    })
  }

  // 6. Status overrides + override emails
  for (const override of overrides) {
    events.push({
      id: `override-${override.id}`,
      type: 'status_override',
      timestamp: override.createdAt,
      title: `Status Override: ${formatStatusLabel(override.previousStatus)} \u2192 ${formatStatusLabel(override.newStatus)}`,
      description: override.justification,
      status: override.newStatus,
      actorName: override.specialistName ?? undefined,
      metadata: { justification: override.justification },
    })

    // Override email (if new status is applicant-facing)
    if (APPLICANT_FACING_STATUSES.has(override.newStatus)) {
      const overrideEmailAt = new Date(override.createdAt.getTime() + 60000)
      const email = generateOverrideEmail(
        {
          previousStatus: override.previousStatus,
          newStatus: override.newStatus,
          justification: override.justification,
          specialistName: override.specialistName,
        },
        appData,
        applicant,
        label.correctionDeadline,
      )
      events.push({
        id: `override-email-${override.id}`,
        type: 'override_email_sent',
        timestamp: overrideEmailAt,
        title: 'Override Notification Sent',
        description: email.subject,
        status: override.newStatus,
        email,
      })
    }
  }

  // 7. Deadline warning (future event — only if deadline exists and hasn't expired)
  if (
    label.correctionDeadline &&
    label.correctionDeadline > new Date() &&
    (effectiveStatus === 'conditionally_approved' ||
      effectiveStatus === 'needs_correction')
  ) {
    events.push({
      id: `deadline-${label.id}`,
      type: 'deadline_warning',
      timestamp: label.correctionDeadline,
      title: 'Correction Deadline',
      description:
        effectiveStatus === 'conditionally_approved'
          ? 'Status will change to "Needs Correction" if corrections are not received'
          : 'Application will be rejected if corrections are not received',
      status: effectiveStatus,
    })
  }

  // Sort reverse-chronologically (most recent first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return events
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    approved: 'Approved',
    conditionally_approved: 'Conditionally Approved',
    needs_correction: 'Needs Correction',
    rejected: 'Rejected',
    pending_review: 'Pending Review',
    processing: 'Processing',
    pending: 'Pending',
  }
  return map[status] ?? status
}

function getStatusDescription(
  status: string,
  items: TimelineValidationItem[],
): string {
  const matches = items.filter((i) => i.status === 'match').length
  const issues = items.filter((i) => i.status !== 'match').length

  switch (status) {
    case 'approved':
      return `All ${matches} field${matches === 1 ? '' : 's'} verified — label meets TTB requirements`
    case 'conditionally_approved':
      return `${matches} field${matches === 1 ? '' : 's'} verified, ${issues} minor discrepanc${issues === 1 ? 'y' : 'ies'} identified`
    case 'needs_correction':
      return `${issues} field${issues === 1 ? '' : 's'} require${issues === 1 ? 's' : ''} correction before approval`
    case 'rejected':
      return `${issues} non-compliant field${issues === 1 ? '' : 's'} — label does not meet TTB requirements`
    case 'pending_review':
      return `AI analysis complete — awaiting specialist review`
    default:
      return `Status determined based on ${items.length} field comparison${items.length === 1 ? '' : 's'}`
  }
}

interface ReviewGroup {
  timestamp: Date
  specialistName: string | null
  reviews: TimelineHumanReview[]
  notes: string | null
}

/**
 * Groups reviews by specialist + timestamp within a 1-minute window,
 * so a single review session appears as one timeline event.
 */
function groupReviewsBySession(reviews: TimelineHumanReview[]): ReviewGroup[] {
  if (reviews.length === 0) return []

  const sorted = [...reviews].sort(
    (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime(),
  )

  const groups: ReviewGroup[] = []
  let current: ReviewGroup = {
    timestamp: sorted[0].reviewedAt,
    specialistName: sorted[0].specialistName,
    reviews: [sorted[0]],
    notes: sorted[0].reviewerNotes,
  }

  for (let i = 1; i < sorted.length; i++) {
    const review = sorted[i]
    const gap = review.reviewedAt.getTime() - current.timestamp.getTime()

    // Same session: same specialist, within 60 seconds
    if (gap < 60_000 && review.specialistName === current.specialistName) {
      current.reviews.push(review)
      if (review.reviewerNotes && !current.notes) {
        current.notes = review.reviewerNotes
      }
    } else {
      groups.push(current)
      current = {
        timestamp: review.reviewedAt,
        specialistName: review.specialistName,
        reviews: [review],
        notes: review.reviewerNotes,
      }
    }
  }
  groups.push(current)

  return groups
}
