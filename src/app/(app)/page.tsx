import type { Metadata } from 'next'
import { Suspense } from 'react'
import { eq, count, and, desc, asc, sql, ilike, type SQL } from 'drizzle-orm'
import { ShieldCheck } from 'lucide-react'

import { db } from '@/db'
import { labels, applicationData } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import {
  getSLATargets,
  getApprovalThreshold,
} from '@/lib/settings/get-settings'
import { fetchSLAMetrics } from '@/lib/sla/queries'
import { getSLAStatus } from '@/lib/sla/status'
import { parsePageSearchParams } from '@/lib/search-params'
import {
  flaggedCountSubquery,
  thumbnailUrlSubquery,
} from '@/lib/db/label-subqueries'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { PageHeader } from '@/components/layout/page-header'
import {
  SLAMetricCard,
  SLAMetricCards,
  type SLAMetricCardData,
} from '@/components/dashboard/sla-metric-card'
import { DashboardAnimatedShell } from '@/components/dashboard/dashboard-animated-shell'
import { SearchInput } from '@/components/shared/search-input'
import { FilterBar } from '@/components/shared/filter-bar'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { LabelsTable } from '@/components/labels/labels-table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const STATUS_FILTERS = [
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

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SLACardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
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

// ---------------------------------------------------------------------------
// Async section: SLA cards + token usage
// ---------------------------------------------------------------------------

async function DashboardSLACards() {
  const [slaMetrics, slaTargets] = await Promise.all([
    fetchSLAMetrics(),
    getSLATargets(),
  ])

  const slaCards: SLAMetricCardData[] = [
    {
      icon: 'Clock',
      label: 'Response Time',
      description:
        'Average time from label submission to first specialist review. Lower is better.',
      value:
        slaMetrics.avgReviewResponseHours !== null
          ? Math.round(slaMetrics.avgReviewResponseHours)
          : null,
      target: slaTargets.reviewResponseHours,
      unit: 'h',
      status:
        slaMetrics.avgReviewResponseHours !== null
          ? getSLAStatus(
              slaMetrics.avgReviewResponseHours,
              slaTargets.reviewResponseHours,
            )
          : 'green',
    },
    {
      icon: 'Gauge',
      label: 'Total Turnaround',
      description:
        'Average time from submission to final decision (approved, rejected, or needs correction). Lower is better.',
      value:
        slaMetrics.avgTotalTurnaroundHours !== null
          ? Math.round(slaMetrics.avgTotalTurnaroundHours)
          : null,
      target: slaTargets.totalTurnaroundHours,
      unit: 'h',
      status:
        slaMetrics.avgTotalTurnaroundHours !== null
          ? getSLAStatus(
              slaMetrics.avgTotalTurnaroundHours,
              slaTargets.totalTurnaroundHours,
            )
          : 'green',
    },
    {
      icon: 'Zap',
      label: 'Approval Rate',
      description:
        'Percentage of labels approved automatically by AI without specialist review. Higher is better.',
      value: slaMetrics.autoApprovalRate,
      target: slaTargets.autoApprovalRateTarget,
      unit: '%',
      status:
        slaMetrics.autoApprovalRate !== null
          ? getSLAStatus(
              slaMetrics.autoApprovalRate,
              slaTargets.autoApprovalRateTarget,
              false,
            )
          : 'green',
    },
    {
      icon: 'Inbox',
      label: 'Queue Depth',
      description:
        'Number of labels waiting for specialist review. Lower means the team is keeping up with incoming submissions.',
      value: slaMetrics.queueDepth,
      target: slaTargets.maxQueueDepth,
      unit: '',
      status: getSLAStatus(slaMetrics.queueDepth, slaTargets.maxQueueDepth),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {slaCards.map((metric, i) => (
        <SLAMetricCard key={metric.label} {...metric} index={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Async section: Labels table (filters + table/empty state)
// ---------------------------------------------------------------------------

async function DashboardLabelsTable({
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
  const offset = (currentPage - 1) * PAGE_SIZE

  // Build where conditions for the table query
  const tableConditions: SQL[] = []
  if (searchTerm) {
    tableConditions.push(ilike(applicationData.brandName, `%${searchTerm}%`))
  }
  if (statusFilter) {
    tableConditions.push(
      eq(
        labels.status,
        statusFilter as (typeof labels.status.enumValues)[number],
      ),
    )
  }
  if (beverageTypeFilter) {
    tableConditions.push(
      eq(
        labels.beverageType,
        beverageTypeFilter as (typeof labels.beverageType.enumValues)[number],
      ),
    )
  }

  // Fetch approval threshold for queue classification
  const approvalThreshold = await getApprovalThreshold()

  // Queue filter: "ready" = pending_review + AI approved + all match + high confidence
  //               "review" = pending_review but not ready
  if (queueFilter === 'ready') {
    tableConditions.push(eq(labels.status, 'pending_review'))
    tableConditions.push(eq(labels.aiProposedStatus, 'approved'))
    tableConditions.push(
      sql`${labels.overallConfidence}::numeric >= ${approvalThreshold}`,
    )
    // All validation items must be 'match'
    tableConditions.push(sql`NOT EXISTS (
      SELECT 1 FROM validation_items vi
      INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
      WHERE vr.label_id = ${labels.id}
      AND vr.is_current = true
      AND vi.status != 'match'
    )`)
  } else if (queueFilter === 'review') {
    tableConditions.push(eq(labels.status, 'pending_review'))
    // NOT ready: either AI didn't approve, or confidence too low, or has non-match items
    tableConditions.push(sql`(
      ${labels.aiProposedStatus} IS DISTINCT FROM 'approved'
      OR ${labels.overallConfidence}::numeric < ${approvalThreshold}
      OR EXISTS (
        SELECT 1 FROM validation_items vi
        INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
        WHERE vr.label_id = ${labels.id}
        AND vr.is_current = true
        AND vi.status != 'match'
      )
    )`)
  }

  const tableWhere =
    tableConditions.length > 0 ? and(...tableConditions) : undefined

  // Flagged count subquery (reused in select and sort)
  const flaggedCountSql = flaggedCountSubquery()

  // Determine sort order: explicit sort param > queue default > global default
  const SORT_COLUMNS: Record<
    string,
    | ReturnType<typeof sql>
    | typeof labels.createdAt
    | typeof applicationData.brandName
    | typeof labels.beverageType
    | typeof labels.overallConfidence
  > = {
    brandName: applicationData.brandName,
    beverageType: labels.beverageType,
    flaggedCount: flaggedCountSql,
    overallConfidence: labels.overallConfidence,
    createdAt: labels.createdAt,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = [sortOrder === 'asc' ? asc(col) : desc(col)]
  } else if (queueFilter === 'ready') {
    orderByClause = [desc(labels.overallConfidence)]
  } else {
    orderByClause = [desc(labels.isPriority), desc(labels.createdAt)]
  }

  const [tableCountResult, statusCountRows, readyCountResult, rows] =
    await Promise.all([
      // Table: filtered count
      db
        .select({ total: count() })
        .from(labels)
        .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
        .where(tableWhere),
      // Status counts (unfiltered, for filter badges)
      db
        .select({
          status: labels.status,
          count: count(),
        })
        .from(labels)
        .groupBy(labels.status),
      // "Ready to Approve" count (pending_review + AI approved + high confidence + all match)
      db
        .select({ total: count() })
        .from(labels)
        .where(
          and(
            eq(labels.status, 'pending_review'),
            eq(labels.aiProposedStatus, 'approved'),
            sql`${labels.overallConfidence}::numeric >= ${approvalThreshold}`,
            sql`NOT EXISTS (
            SELECT 1 FROM validation_items vi
            INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
            WHERE vr.label_id = ${labels.id}
            AND vr.is_current = true
            AND vi.status != 'match'
          )`,
          ),
        ),
      // Table: filtered rows
      db
        .select({
          id: labels.id,
          status: labels.status,
          beverageType: labels.beverageType,
          overallConfidence: labels.overallConfidence,
          correctionDeadline: labels.correctionDeadline,
          deadlineExpired: labels.deadlineExpired,
          isPriority: labels.isPriority,
          createdAt: labels.createdAt,
          brandName: applicationData.brandName,
          flaggedCount: flaggedCountSql,
          thumbnailUrl: thumbnailUrlSubquery(),
          overrideReasonCode: sql<string | null>`(
          SELECT so.reason_code FROM status_overrides so
          WHERE so.label_id = ${labels.id}
          ORDER BY so.created_at DESC
          LIMIT 1
        )`,
        })
        .from(labels)
        .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
        .where(tableWhere)
        .orderBy(...orderByClause)
        .limit(PAGE_SIZE)
        .offset(offset),
    ])

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / PAGE_SIZE)

  // Build status count map for filter badges
  const statusCounts: Record<string, number> = {}
  let totalLabels = 0
  for (const row of statusCountRows) {
    statusCounts[row.status] = row.count
    totalLabels += row.count
  }
  statusCounts['all'] = totalLabels
  statusCounts['ready_to_approve'] = readyCountResult[0]?.total ?? 0

  const labelsWithStatus = rows.map((row) => ({
    ...row,
    thumbnailUrl: row.thumbnailUrl ? getSignedImageUrl(row.thumbnailUrl) : null,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface HomePageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    queue?: string
    sort?: string
    order?: string
    beverageType?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await requireSpecialist()

  const params = await searchParams
  const { user } = session

  const { currentPage, searchTerm, sortKey, sortOrder } =
    parsePageSearchParams(params)
  // Default to "Pending Review" so specialists see actionable items first.
  // "all" means no status filter; absence of param means use default.
  const statusParam = params.status ?? 'pending_review'

  // "ready_to_approve" is a virtual status that maps to queue=ready
  let statusFilter = ''
  let queueFilter = ''
  if (statusParam === 'ready_to_approve') {
    queueFilter = 'ready'
  } else if (statusParam !== 'all') {
    statusFilter = statusParam
  }
  // Legacy: support ?queue= param directly
  if (!queueFilter && params.queue) {
    queueFilter = params.queue
  }

  const beverageTypeFilter = params.beverageType ?? ''

  return (
    <DashboardAnimatedShell
      header={
        <PageHeader
          title="Labels"
          description="All label verification activity and review queue."
        />
      }
      stats={
        <Suspense fallback={<SLACardsSkeleton />}>
          <DashboardSLACards />
        </Suspense>
      }
      filters={
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SearchInput
              paramKey="search"
              placeholder="Search by brand name..."
              className="flex-1"
            />
            <ResetFiltersButton
              paramKeys={['status', 'beverageType', 'queue']}
            />
          </div>
          <Suspense fallback={<TableSkeleton />}>
            <DashboardLabelsTable
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              queueFilter={queueFilter}
              beverageTypeFilter={beverageTypeFilter}
              sortKey={sortKey}
              sortOrder={sortOrder}
              currentPage={currentPage}
              userRole={user.role}
            />
          </Suspense>
        </div>
      }
      table={null}
    />
  )
}
