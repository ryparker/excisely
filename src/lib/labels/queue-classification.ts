// ---------------------------------------------------------------------------
// Queue classification — determines whether a label is "ready to approve"
// (batch-approvable) or "needs review" (requires manual specialist review)
// ---------------------------------------------------------------------------

export type QueueCategory = 'ready' | 'review' | 'other'

interface QueueClassificationInput {
  status: string
  aiProposedStatus: string | null
  overallConfidence: number | null
  validationItemStatuses: string[]
}

/**
 * Classifies a label into a queue category:
 * - `ready`: batch-approvable (AI would have approved, all items match, high confidence)
 * - `review`: requires manual specialist review (pending_review but not ready)
 * - `other`: not in the review pipeline (approved, rejected, processing, etc.)
 */
export function classifyQueue(
  input: QueueClassificationInput,
  approvalThreshold: number,
): QueueCategory {
  // Only pending_review labels are in the queue
  if (input.status !== 'pending_review') {
    return 'other'
  }

  // "Ready to Approve" criteria:
  // 1. AI proposed approved
  // 2. Confidence meets threshold
  // 3. All validation items are match
  const isAiApproved = input.aiProposedStatus === 'approved'
  const meetsThreshold =
    input.overallConfidence !== null &&
    input.overallConfidence >= approvalThreshold
  const allMatch =
    input.validationItemStatuses.length > 0 &&
    input.validationItemStatuses.every((s) => s === 'match')

  if (isAiApproved && meetsThreshold && allMatch) {
    return 'ready'
  }

  return 'review'
}
