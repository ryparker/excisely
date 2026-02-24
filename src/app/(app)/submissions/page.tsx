import { redirect } from 'next/navigation'
import {
  eq,
  and,
  desc,
  asc,
  count,
  ilike,
  or,
  sql,
  gt,
  type SQL,
} from 'drizzle-orm'

import { db } from '@/db'
import { labels, applicationData, applicants } from '@/db/schema'
import { requireApplicant } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { AutoRefresh } from '@/components/shared/auto-refresh'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { SearchInput } from '@/components/shared/search-input'
import { SubmissionsSummaryCards } from '@/components/submissions/submissions-summary-cards'
import { SubmissionsTable } from '@/components/submissions/submissions-table'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

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
  const currentPage = Math.max(1, Number(params.page) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE
  const searchTerm = params.search?.trim() ?? ''
  const statusFilter = params.status ?? ''
  const beverageTypeFilter = params.beverageType ?? ''
  const sortKey = params.sort ?? ''
  const sortOrder = params.order === 'asc' ? 'asc' : 'desc'

  // Find applicant record by email
  const [applicantRecord] = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(eq(applicants.contactEmail, session.user.email))
    .limit(1)

  // No applicant record means no submissions — go straight to submit
  if (!applicantRecord) redirect('/submit')

  // Build where conditions
  const conditions: SQL[] = [eq(labels.applicantId, applicantRecord.id)]

  // Multi-field search
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

  // Flagged count subquery (reused in select and sort)
  const flaggedCountSql = sql<number>`(
    SELECT count(*)::int FROM validation_items vi
    INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
    WHERE vr.label_id = ${labels.id}
    AND vr.is_current = true
    AND vi.status IN ('needs_correction', 'mismatch', 'not_found')
  )`

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

  const [tableCountResult, statusCountRows, rows, nearestDeadlineResult] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(labels)
        .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
        .where(whereClause),
      // Unfiltered status counts (scoped to this applicant) for summary cards
      db
        .select({ status: labels.status, count: count() })
        .from(labels)
        .where(eq(labels.applicantId, applicantRecord.id))
        .groupBy(labels.status),
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
          thumbnailUrl: sql<string | null>`(
          SELECT li.image_url FROM label_images li
          WHERE li.label_id = ${labels.id}
          ORDER BY
            CASE WHEN li.image_type = 'front' THEN 0 ELSE 1 END,
            li.sort_order
          LIMIT 1
        )`,
        })
        .from(labels)
        .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(PAGE_SIZE)
        .offset(offset),
      // Nearest correction deadline
      db
        .select({ deadline: labels.correctionDeadline })
        .from(labels)
        .where(
          and(
            eq(labels.applicantId, applicantRecord.id),
            gt(labels.correctionDeadline, new Date()),
            eq(labels.deadlineExpired, false),
          ),
        )
        .orderBy(asc(labels.correctionDeadline))
        .limit(1),
    ])

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / PAGE_SIZE)

  // Build status count map for summary cards
  const statusCounts: Record<string, number> = {}
  let totalLabels = 0
  for (const row of statusCountRows) {
    statusCounts[row.status] = row.count
    totalLabels += row.count
  }

  // Summary stats
  const approvedCount = statusCounts['approved'] ?? 0
  const inReviewCount =
    (statusCounts['pending'] ?? 0) +
    (statusCounts['processing'] ?? 0) +
    (statusCounts['pending_review'] ?? 0)
  const attentionCount =
    (statusCounts['needs_correction'] ?? 0) +
    (statusCounts['conditionally_approved'] ?? 0)
  const approvalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : 0

  // Nearest deadline text
  let nearestDeadlineText: string | null = null
  if (nearestDeadlineResult[0]?.deadline) {
    const dl = nearestDeadlineResult[0].deadline
    const days = Math.ceil((dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    nearestDeadlineText =
      days <= 0
        ? 'Deadline expired'
        : `Next deadline in ${days} day${days !== 1 ? 's' : ''}`
  }

  const labelsWithStatus = rows.map((row) => ({
    ...row,
    thumbnailUrl: row.thumbnailUrl ? getSignedImageUrl(row.thumbnailUrl) : null,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  const hasAnySubmissions = totalLabels > 0

  // First-time applicants go straight to the submit page
  if (!hasAnySubmissions) redirect('/submit')

  return (
    <PageShell className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="My Submissions"
        description="Your submitted label applications and their verification results."
      />

      <SubmissionsSummaryCards
        total={totalLabels}
        approved={approvedCount}
        approvalRate={approvalRate}
        inReview={inReviewCount}
        needsAttention={attentionCount}
        nearestDeadline={nearestDeadlineText}
      />

      <div className="flex items-center gap-2">
        <SearchInput
          paramKey="search"
          placeholder="Search by name, serial number, or type..."
          className="flex-1"
        />
        <ResetFiltersButton paramKeys={['status', 'beverageType']} />
      </div>

      {labelsWithStatus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No submissions match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SubmissionsTable
          rows={labelsWithStatus}
          totalPages={totalPages}
          tableTotal={tableTotal}
          pageSize={PAGE_SIZE}
          searchTerm={searchTerm}
        />
      )}
    </PageShell>
  )
}
