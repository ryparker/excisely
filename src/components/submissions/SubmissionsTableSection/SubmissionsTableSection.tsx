import { getFilteredLabels } from '@/db/queries/labels'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { SubmissionsTable } from '@/components/submissions/SubmissionsTable'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 20

export function SubmissionsTableSkeleton() {
  return (
    <Card className="overflow-hidden py-0">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex gap-6">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
      <div className="flex items-center justify-between px-6 py-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Card>
  )
}

export async function SubmissionsTableSection({
  applicantId,
  searchTerm,
  statusFilter,
  beverageTypeFilter,
  sortKey,
  sortOrder,
  currentPage,
}: {
  applicantId: string
  searchTerm: string
  statusFilter: string
  beverageTypeFilter: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
  currentPage: number
}) {
  const { rows, tableTotal, totalPages } = await getFilteredLabels({
    applicantId,
    searchTerm: searchTerm || undefined,
    statusFilter: statusFilter || undefined,
    beverageTypeFilter: beverageTypeFilter || undefined,
    sortKey: sortKey || undefined,
    sortOrder,
    currentPage,
    pageSize: PAGE_SIZE,
  })

  // Applicant view — rows have applicant-specific fields
  const labelsWithStatus = rows.map((row) => {
    const r = row as typeof row & {
      fancifulName: string | null
      serialNumber: string | null
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

  if (labelsWithStatus.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No submissions match your filters.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <SubmissionsTable
      rows={labelsWithStatus}
      totalPages={totalPages}
      tableTotal={tableTotal}
      pageSize={PAGE_SIZE}
      searchTerm={searchTerm}
    />
  )
}
