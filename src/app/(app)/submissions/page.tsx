import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq, and, desc, asc, count, ilike, or, gt, type SQL } from 'drizzle-orm'

import { db } from '@/db'
import { labels, applicationData, applicants } from '@/db/schema'
import { requireApplicant } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { parsePageSearchParams } from '@/lib/search-params'
import {
  flaggedCountSubquery,
  thumbnailUrlSubquery,
} from '@/lib/db/label-subqueries'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { Plus } from 'lucide-react'

import { AutoRefresh } from '@/components/shared/auto-refresh'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { SearchInput } from '@/components/shared/search-input'
import { SubmissionsSummaryCards } from '@/components/submissions/submissions-summary-cards'
import { SubmissionsTable } from '@/components/submissions/submissions-table'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Submissions',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function formatDeadlineText(deadline: Date): string {
  const days = Math.ceil(
    (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  return days <= 0
    ? 'Deadline expired'
    : `Next deadline in ${days} day${days !== 1 ? 's' : ''}`
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SummaryCardsSkeleton() {
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

function TableSkeleton() {
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

// ---------------------------------------------------------------------------
// Async section: Summary Cards
// ---------------------------------------------------------------------------

async function SubmissionsSummarySection({
  applicantId,
}: {
  applicantId: string
}) {
  const [statusCountRows, nearestDeadlineResult] = await Promise.all([
    db
      .select({ status: labels.status, count: count() })
      .from(labels)
      .where(eq(labels.applicantId, applicantId))
      .groupBy(labels.status),
    db
      .select({ deadline: labels.correctionDeadline })
      .from(labels)
      .where(
        and(
          eq(labels.applicantId, applicantId),
          gt(labels.correctionDeadline, new Date()),
          eq(labels.deadlineExpired, false),
        ),
      )
      .orderBy(asc(labels.correctionDeadline))
      .limit(1),
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

  const nearestDeadlineText = nearestDeadlineResult[0]?.deadline
    ? formatDeadlineText(nearestDeadlineResult[0].deadline)
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

// ---------------------------------------------------------------------------
// Async section: Submissions Table
// ---------------------------------------------------------------------------

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

interface SubmissionsTableSectionProps {
  applicantId: string
  searchTerm: string
  statusFilter: string
  beverageTypeFilter: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
  currentPage: number
}

async function SubmissionsTableSection({
  applicantId,
  searchTerm,
  statusFilter,
  beverageTypeFilter,
  sortKey,
  sortOrder,
  currentPage,
}: SubmissionsTableSectionProps) {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface SubmissionsPageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    beverageType?: string
    sort?: string
    order?: string
  }>
}

export default async function SubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  const session = await requireApplicant()

  const params = await searchParams
  const { currentPage, searchTerm, sortKey, sortOrder } =
    parsePageSearchParams(params)
  const statusFilter = params.status ?? ''
  const beverageTypeFilter = params.beverageType ?? ''

  // Find applicant record by email
  const [applicantRecord] = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(eq(applicants.contactEmail, session.user.email))
    .limit(1)

  // No applicant record means no submissions — go straight to submit
  if (!applicantRecord) redirect('/submit')

  // Quick count check — redirect first-time applicants before rendering
  const [{ total }] = await db
    .select({ total: count() })
    .from(labels)
    .where(eq(labels.applicantId, applicantRecord.id))

  if (total === 0) redirect('/submit')

  return (
    <PageShell className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="My Submissions"
        description="Your submitted label applications and their verification results."
      />

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SubmissionsSummarySection applicantId={applicantRecord.id} />
      </Suspense>

      <div className="flex items-center gap-2">
        <SearchInput
          paramKey="search"
          placeholder="Search by name, serial number, or type..."
          className="flex-1"
        />
        <ResetFiltersButton paramKeys={['status', 'beverageType']} />
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <SubmissionsTableSection
          applicantId={applicantRecord.id}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          beverageTypeFilter={beverageTypeFilter}
          sortKey={sortKey}
          sortOrder={sortOrder}
          currentPage={currentPage}
        />
      </Suspense>
      {/* Mobile FAB — quick access to new submission */}
      <Link
        href="/submit"
        className="fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        aria-label="New submission"
      >
        <Plus className="size-6" />
      </Link>
    </PageShell>
  )
}
