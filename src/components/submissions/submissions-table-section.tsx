import { eq, and, desc, asc, count, ilike, or, type SQL } from 'drizzle-orm'

import { db } from '@/db'
import { labels, applicationData } from '@/db/schema'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import {
  flaggedCountSubquery,
  thumbnailUrlSubquery,
} from '@/lib/db/label-subqueries'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { SubmissionsTable } from '@/components/submissions/submissions-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 20

// Map sort keys to Drizzle columns
const SORT_COLUMNS: Record<
  string,
  | typeof labels.createdAt
  | typeof applicationData.brandName
  | typeof labels.beverageType
  | typeof labels.status
> = {
  brandName: applicationData.brandName,
  beverageType: labels.beverageType,
  createdAt: labels.createdAt,
  status: labels.status,
}

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
  const offset = (currentPage - 1) * PAGE_SIZE

  // Build where conditions
  const conditions: SQL[] = [eq(labels.applicantId, applicantId)]

  if (searchTerm) {
    conditions.push(
      or(
        ilike(applicationData.brandName, `%${searchTerm}%`),
        ilike(applicationData.fancifulName, `%${searchTerm}%`),
        ilike(applicationData.serialNumber, `%${searchTerm}%`),
        ilike(applicationData.classType, `%${searchTerm}%`),
      )!,
    )
  }

  if (statusFilter === 'in_review') {
    conditions.push(
      or(
        eq(labels.status, 'pending'),
        eq(labels.status, 'processing'),
        eq(labels.status, 'pending_review'),
      )!,
    )
  } else if (statusFilter === 'needs_attention') {
    conditions.push(
      or(
        eq(labels.status, 'needs_correction'),
        eq(labels.status, 'conditionally_approved'),
      )!,
    )
  } else if (statusFilter) {
    conditions.push(
      eq(
        labels.status,
        statusFilter as (typeof labels.status.enumValues)[number],
      ),
    )
  }

  if (beverageTypeFilter) {
    conditions.push(
      eq(
        labels.beverageType,
        beverageTypeFilter as (typeof labels.beverageType.enumValues)[number],
      ),
    )
  }

  const whereClause = and(...conditions)

  // Flagged count subquery
  const flaggedCountSql = flaggedCountSubquery()

  // Build ORDER BY
  let orderByClause
  if (sortKey === 'flaggedCount') {
    orderByClause =
      sortOrder === 'asc' ? asc(flaggedCountSql) : desc(flaggedCountSql)
  } else if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = desc(labels.createdAt)
  }

  const [tableCountResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(whereClause),
    db
      .select({
        id: labels.id,
        status: labels.status,
        beverageType: labels.beverageType,
        correctionDeadline: labels.correctionDeadline,
        deadlineExpired: labels.deadlineExpired,
        createdAt: labels.createdAt,
        brandName: applicationData.brandName,
        fancifulName: applicationData.fancifulName,
        serialNumber: applicationData.serialNumber,
        flaggedCount: flaggedCountSql,
        thumbnailUrl: thumbnailUrlSubquery(),
      })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / PAGE_SIZE)

  const labelsWithStatus = rows.map((row) => ({
    ...row,
    thumbnailUrl: row.thumbnailUrl ? getSignedImageUrl(row.thumbnailUrl) : null,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

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
