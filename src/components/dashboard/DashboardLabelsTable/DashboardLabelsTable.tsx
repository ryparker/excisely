import { ShieldCheck } from 'lucide-react'

import {
  getStatusCounts,
  getReadyToApproveCount,
  getFilteredLabels,
} from '@/db/queries/labels'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { FilterBar } from '@/components/shared/FilterBar'
import { LabelsTable } from '@/components/labels/LabelsTable'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 20

export const STATUS_FILTERS = [
  {
    label: 'All',
    value: 'all',
    description: 'Show all labels regardless of status.',
  },
  {
    label: 'Ready to Approve',
    value: 'ready_to_approve',
    attention: true,
    description:
      'High-confidence labels where AI found all fields match. Select rows and batch approve.',
  },
  {
    label: 'Pending Review',
    value: 'pending_review',
    attention: true,
    description:
      'AI analysis is complete. These labels need specialist review.',
  },
  {
    label: 'Approved',
    value: 'approved',
    description:
      'Labels that have been fully approved. No further action needed.',
  },
  {
    label: 'Conditionally Approved',
    value: 'conditionally_approved',
    description:
      'Approved with conditions. Applicant has 7 days to submit corrections.',
  },
  {
    label: 'Needs Correction',
    value: 'needs_correction',
    attention: true,
    description:
      'Issues identified that require applicant corrections within 30 days.',
  },
  {
    label: 'Rejected',
    value: 'rejected',
    description:
      'Label applications that were rejected. Applicants have been notified.',
  },
] as const

export function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

export async function DashboardLabelsTable({
  searchTerm,
  statusFilter,
  queueFilter,
  beverageTypeFilter,
  sortKey,
  sortOrder,
  currentPage,
  userRole,
}: {
  searchTerm: string
  statusFilter: string
  queueFilter: string
  beverageTypeFilter: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
  currentPage: number
  userRole: string
}) {
  const [statusCountRows, readyCount, filteredResult] = await Promise.all([
    getStatusCounts(),
    getReadyToApproveCount(),
    getFilteredLabels({
      searchTerm: searchTerm || undefined,
      statusFilter: statusFilter || undefined,
      queueFilter: queueFilter || undefined,
      beverageTypeFilter: beverageTypeFilter || undefined,
      sortKey: sortKey || undefined,
      sortOrder,
      currentPage,
      pageSize: PAGE_SIZE,
    }),
  ])

  const { rows, tableTotal, totalPages } = filteredResult

  // Build status count map for filter badges
  const statusCounts: Record<string, number> = {}
  let totalLabels = 0
  for (const row of statusCountRows) {
    statusCounts[row.status] = row.count
    totalLabels += row.count
  }
  statusCounts['all'] = totalLabels
  statusCounts['ready_to_approve'] = readyCount

  // Specialist view (no applicantId) — rows have specialist-specific fields
  const labelsWithStatus = rows.map((row) => {
    const r = row as typeof row & {
      overallConfidence: string | null
      isPriority: boolean
      overrideReasonCode: string | null
      thumbnailUrl: string | null
    }
    return {
      ...r,
      thumbnailUrl: r.thumbnailUrl ? getSignedImageUrl(r.thumbnailUrl) : null,
      effectiveStatus: getEffectiveStatus({
        status: r.status,
        correctionDeadline: r.correctionDeadline,
        deadlineExpired: r.deadlineExpired,
      }),
    }
  })

  return (
    <>
      <FilterBar
        paramKey="status"
        defaultValue="pending_review"
        options={STATUS_FILTERS.map((f) => ({
          label: f.label,
          value: f.value,
          count: statusCounts[f.value] ?? 0,
          attention:
            'attention' in f && f.attention && (statusCounts[f.value] ?? 0) > 0,
          description: f.description,
        }))}
      />
      {labelsWithStatus.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchTerm || statusFilter || queueFilter
                ? 'No labels match your filters.'
                : 'No labels validated yet.'}
            </p>
            {!searchTerm && !statusFilter && !queueFilter && (
              <p className="mt-1 text-xs text-muted-foreground/60">
                Labels will appear here once applicants submit them.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <LabelsTable
          labels={labelsWithStatus}
          userRole={userRole}
          totalPages={totalPages}
          tableTotal={tableTotal}
          pageSize={PAGE_SIZE}
          queueMode={
            queueFilter === 'ready'
              ? 'ready'
              : queueFilter === 'review'
                ? 'review'
                : undefined
          }
          searchTerm={searchTerm}
        />
      )}
    </>
  )
}
