import { getStatusCounts, getNearestDeadline } from '@/db/queries/labels'
import { SubmissionsSummaryCards } from '@/components/submissions/SubmissionsSummaryCards'
import { Skeleton } from '@/components/ui/Skeleton'
import { pluralize } from '@/lib/pluralize'

function formatDeadlineText(deadline: Date): string {
  const days = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  return days <= 0
    ? 'Deadline expired'
    : `Next deadline in ${pluralize(days, 'day')}`
}

export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export async function SubmissionsSummarySection({
  applicantId,
}: {
  applicantId: string
}) {
  const [statusCountRows, nearestDeadline] = await Promise.all([
    getStatusCounts(applicantId),
    getNearestDeadline(applicantId),
  ])

  const statusCounts: Record<string, number> = {}
  let totalLabels = 0
  for (const row of statusCountRows) {
    statusCounts[row.status] = row.count
    totalLabels += row.count
  }

  const approvedCount = statusCounts['approved'] ?? 0
  const inReviewCount =
    (statusCounts['pending'] ?? 0) +
    (statusCounts['processing'] ?? 0) +
    (statusCounts['pending_review'] ?? 0)
  const attentionCount =
    (statusCounts['needs_correction'] ?? 0) +
    (statusCounts['conditionally_approved'] ?? 0)
  const reviewedCount =
    approvedCount +
    (statusCounts['needs_correction'] ?? 0) +
    (statusCounts['conditionally_approved'] ?? 0) +
    (statusCounts['rejected'] ?? 0)
  const approvalRate =
    reviewedCount > 0 ? Math.round((approvedCount / reviewedCount) * 100) : 0

  const nearestDeadlineText = nearestDeadline
    ? formatDeadlineText(nearestDeadline)
    : null

  return (
    <SubmissionsSummaryCards
      total={totalLabels}
      approved={approvedCount}
      approvalRate={approvalRate}
      inReview={inReviewCount}
      needsAttention={attentionCount}
      nearestDeadline={nearestDeadlineText}
    />
  )
}
