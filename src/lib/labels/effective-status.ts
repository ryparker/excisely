type LabelStatus =
  | 'pending'
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'conditionally_approved'
  | 'needs_correction'
  | 'rejected'

interface LabelForStatus {
  status: LabelStatus
  correctionDeadline: Date | null
  deadlineExpired: boolean
  /** When provided, enables stale processing detection (>5 min → pending_review). */
  updatedAt?: Date
}

/** Labels stuck in 'processing' longer than this are treated as crashed pipelines. */
const STALE_PROCESSING_MS = 5 * 60 * 1000

/**
 * Computes the effective status of a label by checking whether its correction
 * deadline has passed or whether a processing pipeline has gone stale.
 * This implements "lazy status recovery" — no cron job needed. Call this
 * whenever displaying a label's status and fire-and-forget a DB update
 * if the effective status differs from the stored status.
 *
 * - `processing` + stuck >5 min (with `updatedAt`) -> `pending_review`
 * - `needs_correction` + deadline passed -> `rejected`
 * - `conditionally_approved` + deadline passed -> `needs_correction`
 * - All other statuses pass through unchanged
 */
export function getEffectiveStatus(label: LabelForStatus): LabelStatus {
  const status = label.status
  const now = new Date()

  // Stale processing recovery: if the pipeline crashed or timed out,
  // surface the label as pending_review so it's actionable again.
  if (status === 'processing' && label.updatedAt) {
    const age = now.getTime() - label.updatedAt.getTime()
    if (age > STALE_PROCESSING_MS) {
      return 'pending_review'
    }
  }

  if (!label.correctionDeadline) {
    return status
  }

  const deadlinePassed =
    label.deadlineExpired || label.correctionDeadline <= now

  if (!deadlinePassed) {
    return status
  }

  if (status === 'needs_correction') {
    return 'rejected'
  }

  if (status === 'conditionally_approved') {
    return 'needs_correction'
  }

  return status
}

// ---------------------------------------------------------------------------
// Deadline info
// ---------------------------------------------------------------------------

type Urgency = 'green' | 'amber' | 'red' | 'expired'

interface DeadlineInfo {
  daysRemaining: number
  urgency: Urgency
}

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_HOUR = 1000 * 60 * 60

/**
 * Returns deadline information including days remaining and a color-coded
 * urgency level. Returns null if no deadline is set.
 *
 * - green: more than 7 days remaining
 * - amber: 1-7 days remaining
 * - red: less than 24 hours remaining
 * - expired: deadline has passed
 */
export function getDeadlineInfo(deadline: Date | null): DeadlineInfo | null {
  if (!deadline) {
    return null
  }

  const now = new Date()
  const remainingMs = deadline.getTime() - now.getTime()
  const daysRemaining = Math.ceil(remainingMs / MS_PER_DAY)

  if (remainingMs <= 0) {
    return { daysRemaining: 0, urgency: 'expired' }
  }

  let urgency: Urgency
  if (remainingMs < MS_PER_HOUR * 24) {
    urgency = 'red'
  } else if (daysRemaining <= 7) {
    urgency = 'amber'
  } else {
    urgency = 'green'
  }

  return { daysRemaining, urgency }
}
