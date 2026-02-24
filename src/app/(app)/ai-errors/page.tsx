import type { Metadata } from 'next'
import { Suspense } from 'react'
import { and, eq, sql, count, desc, asc, ilike, type SQL } from 'drizzle-orm'
import { Flag, AlertTriangle, ShieldAlert, Activity } from 'lucide-react'

import { db } from '@/db'
import { humanReviews, validationItems, users } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { fetchTokenUsageMetrics } from '@/lib/sla/queries'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { SearchInput } from '@/components/shared/search-input'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { AIErrorsTable } from '@/components/ai-errors/ai-errors-table'
import { StatCard, STAT_CARD_BASE } from '@/components/shared/stat-card'
import { TokenUsageSummary } from '@/components/dashboard/token-usage-summary'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'AI Errors',
}

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_NAMES = Object.keys(FIELD_DISPLAY_NAMES)

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function AIErrorStatsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={STAT_CARD_BASE}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-xl" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-1.5 h-3 w-32" />
        </div>
      ))}
      <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  )
}

function AIErrorTableSkeleton() {
  return (
    <Card className="overflow-hidden py-0">
      {/* Table header */}
      <div className="border-b bg-muted/50 px-6 py-3">
        <div className="flex gap-6">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-6 py-3">
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Async section: Stats cards
// ---------------------------------------------------------------------------

async function AIErrorStats() {
  const [statsResult, tokenUsageMetrics] = await Promise.all([
    db
      .select({
        totalErrors: count(),
        missedErrors: sql<number>`count(case when ${humanReviews.originalStatus} = 'match' and ${humanReviews.resolvedStatus} != 'match' then 1 end)`,
        overFlagged: sql<number>`count(case when ${humanReviews.originalStatus} != 'match' and ${humanReviews.resolvedStatus} = 'match' then 1 end)`,
      })
      .from(humanReviews)
      .where(
        sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`,
      )
      .then((rows) => rows[0]),
    fetchTokenUsageMetrics(),
  ])

  const stats = {
    totalErrors: statsResult?.totalErrors ?? 0,
    missedErrors: statsResult?.missedErrors ?? 0,
    overFlagged: statsResult?.overFlagged ?? 0,
  }

  const missedBg =
    stats.missedErrors === 0
      ? 'bg-emerald-100 dark:bg-emerald-900/30'
      : 'bg-amber-100 dark:bg-amber-900/30'
  const missedTint =
    stats.missedErrors === 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400'
  const missedValueColor =
    stats.missedErrors === 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400'

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Activity}
        iconBg="bg-muted"
        iconColor="text-muted-foreground"
        label="Total AI Errors"
        value={stats.totalErrors}
        description="Across all reviewed labels"
      />
      <StatCard
        icon={AlertTriangle}
        iconBg={missedBg}
        iconColor={missedTint}
        label="Missed Errors"
        value={stats.missedErrors}
        description="AI said match, specialist disagreed"
        valueClassName={missedValueColor}
      />
      <StatCard
        icon={ShieldAlert}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        label="Over-Flagged"
        value={stats.overFlagged}
        description="AI flagged, specialist confirmed match"
        valueClassName="text-blue-700 dark:text-blue-400"
      />
      <TokenUsageSummary metrics={tokenUsageMetrics} index={3} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Async section: Table
// ---------------------------------------------------------------------------

async function AIErrorTableSection({
  searchTerm,
  fieldFilter,
  typeFilter,
  sortKey,
  sortOrder,
  currentPage,
}: {
  searchTerm: string
  fieldFilter: string
  typeFilter: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
  currentPage: number
}) {
  const statusMismatch = sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`
  const conditions: SQL[] = [statusMismatch]

  if (fieldFilter && FIELD_NAMES.includes(fieldFilter)) {
    conditions.push(
      eq(
        validationItems.fieldName,
        fieldFilter as (typeof validationItems.fieldName.enumValues)[number],
      ),
    )
  }

  if (typeFilter === 'missed') {
    conditions.push(eq(humanReviews.originalStatus, 'match'))
  } else if (typeFilter === 'over_flagged') {
    conditions.push(sql`${humanReviews.originalStatus}::text != 'match'`)
    conditions.push(eq(humanReviews.resolvedStatus, 'match'))
  }

  if (searchTerm) {
    conditions.push(
      ilike(
        sql`(
          SELECT ad.brand_name FROM application_data ad
          WHERE ad.label_id = ${humanReviews.labelId}
          LIMIT 1
        )`,
        `%${searchTerm}%`,
      ),
    )
  }

  const offset = (currentPage - 1) * PAGE_SIZE

  // Brand name subquery for sorting
  const brandNameSql = sql`(
    SELECT ad.brand_name FROM application_data ad
    WHERE ad.label_id = ${humanReviews.labelId}
    LIMIT 1
  )`

  // Sort column mapping
  const SORT_COLUMNS: Record<
    string,
    | ReturnType<typeof sql>
    | typeof humanReviews.reviewedAt
    | typeof validationItems.fieldName
    | typeof validationItems.confidence
  > = {
    reviewedAt: humanReviews.reviewedAt,
    fieldName: validationItems.fieldName,
    confidence: validationItems.confidence,
    brandName: brandNameSql,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = [sortOrder === 'asc' ? asc(col) : desc(col)]
  } else {
    orderByClause = [desc(humanReviews.reviewedAt)]
  }

  const [totalQuery, rows] = await Promise.all([
    db
      .select({ count: count() })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .where(and(...conditions)),
    db
      .select({
        id: humanReviews.id,
        reviewedAt: humanReviews.reviewedAt,
        originalStatus: humanReviews.originalStatus,
        resolvedStatus: humanReviews.resolvedStatus,
        reviewerNotes: humanReviews.reviewerNotes,
        fieldName: validationItems.fieldName,
        confidence: validationItems.confidence,
        labelId: humanReviews.labelId,
        brandName: sql<string>`(
          SELECT ad.brand_name FROM application_data ad
          WHERE ad.label_id = ${humanReviews.labelId}
          LIMIT 1
        )`,
        specialistName: users.name,
      })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .innerJoin(users, eq(humanReviews.specialistId, users.id))
      .where(and(...conditions))
      .orderBy(...orderByClause)
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const totalCount = totalQuery[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Flag className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No AI errors found</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {searchTerm || fieldFilter || typeFilter
              ? 'Try adjusting your filters to see more results.'
              : 'When specialists override AI classifications during review, discrepancies will appear here.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <AIErrorsTable
      rows={rows}
      totalPages={totalPages}
      tableTotal={totalCount}
      pageSize={PAGE_SIZE}
      searchTerm={searchTerm}
    />
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface AIErrorsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AIErrorsPage({
  searchParams,
}: AIErrorsPageProps) {
  await requireSpecialist()

  await searchParamsCache.parse(searchParams)
  const currentPage = Math.max(1, searchParamsCache.get('page'))
  const searchTerm = searchParamsCache.get('search')
  const sortKey = searchParamsCache.get('sort')
  const sortOrder = searchParamsCache.get('order') === 'asc' ? 'asc' : 'desc'
  const fieldFilter = searchParamsCache.get('field')
  const typeFilter = searchParamsCache.get('type')

  return (
    <PageShell className="space-y-8">
      <PageHeader
        title="AI Errors"
        description="Fields where specialist review disagreed with AI classification."
      />
      <Suspense fallback={<AIErrorStatsSkeleton />}>
        <AIErrorStats />
      </Suspense>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SearchInput
            paramKey="search"
            placeholder="Search by brand name..."
            className="flex-1"
          />
          <ResetFiltersButton paramKeys={['field', 'type', 'search']} />
        </div>
        <Suspense fallback={<AIErrorTableSkeleton />}>
          <AIErrorTableSection
            searchTerm={searchTerm}
            fieldFilter={fieldFilter}
            typeFilter={typeFilter}
            sortKey={sortKey}
            sortOrder={sortOrder}
            currentPage={currentPage}
          />
        </Suspense>
      </div>
    </PageShell>
  )
}
