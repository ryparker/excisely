import Link from 'next/link'
import { eq, count, and, gte, desc, sql, ilike, type SQL } from 'drizzle-orm'
import {
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'

import { db } from '@/db'
import { labels, applicationData } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import {
  getEffectiveStatus,
  getDeadlineInfo,
} from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { SearchInput } from '@/components/shared/search-input'
import { FilterBar } from '@/components/shared/filter-bar'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const BEVERAGE_TYPE_LABELS: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
}

const REVIEWABLE_STATUSES = new Set([
  'pending_review',
  'needs_correction',
  'conditionally_approved',
])

const URGENCY_COLORS: Record<string, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
}

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'Conditionally Approved', value: 'conditionally_approved' },
  { label: 'Needs Correction', value: 'needs_correction' },
  { label: 'Rejected', value: 'rejected' },
] as const

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatConfidence(value: string | null): string {
  if (!value) return '--'
  const num = Number(value)
  return `${Math.round(num)}%`
}

function formatDeadline(deadline: Date | null): React.ReactNode {
  const info = getDeadlineInfo(deadline)
  if (!info) return '--'

  const colorClass = URGENCY_COLORS[info.urgency] ?? 'text-muted-foreground'

  if (info.urgency === 'expired') {
    return <span className={colorClass}>Expired</span>
  }

  return (
    <span className={colorClass}>
      {info.daysRemaining} day{info.daysRemaining !== 1 ? 's' : ''}
    </span>
  )
}

interface HomePageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession()
  if (!session) return null

  const params = await searchParams
  const { user } = session
  const isAdmin = user.role === 'admin'
  const ownerFilter = isAdmin ? undefined : eq(labels.specialistId, user.id)

  const currentPage = Math.max(1, Number(params.page) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE
  const searchTerm = params.search?.trim() ?? ''
  const statusFilter = params.status ?? ''

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Build where conditions for the table query
  const tableConditions: SQL[] = []
  if (ownerFilter) tableConditions.push(ownerFilter)
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
  const tableWhere =
    tableConditions.length > 0 ? and(...tableConditions) : undefined

  const [
    totalResult,
    todayResult,
    approvedResult,
    pendingResult,
    tableCountResult,
    rows,
  ] = await Promise.all([
    // Stats: total labels
    db.select({ total: count() }).from(labels).where(ownerFilter),
    // Stats: today's count
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(ownerFilter, gte(labels.createdAt, todayStart))
          : gte(labels.createdAt, todayStart),
      ),
    // Stats: approved count
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(ownerFilter, eq(labels.status, 'approved'))
          : eq(labels.status, 'approved'),
      ),
    // Stats: pending reviews
    db
      .select({ total: count() })
      .from(labels)
      .where(
        ownerFilter
          ? and(
              ownerFilter,
              sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
            )
          : sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
      ),
    // Table: filtered count
    db
      .select({ total: count() })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(tableWhere),
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
        flaggedCount: sql<number>`(
          SELECT count(*)::int FROM validation_items vi
          INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
          WHERE vr.label_id = ${labels.id}
          AND vr.is_current = true
          AND vi.status IN ('needs_correction', 'mismatch', 'not_found')
        )`,
      })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(tableWhere)
      .orderBy(desc(labels.isPriority), desc(labels.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const totalLabels = totalResult[0]?.total ?? 0
  const todayCount = todayResult[0]?.total ?? 0
  const approvedCount = approvedResult[0]?.total ?? 0
  const pendingReviews = pendingResult[0]?.total ?? 0
  const approvalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : 0

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / PAGE_SIZE)

  const stats = [
    {
      label: 'Total Processed',
      value: totalLabels,
      icon: ShieldCheck,
      description: isAdmin ? 'All labels' : 'Your labels',
    },
    {
      label: "Today's Validations",
      value: todayCount,
      icon: Clock,
      description: 'Labels validated today',
    },
    {
      label: 'Approval Rate',
      value: `${approvalRate}%`,
      icon: TrendingUp,
      description: 'Approved vs total',
    },
    {
      label: 'Pending Reviews',
      value: pendingReviews,
      icon: AlertCircle,
      description: 'Labels awaiting review',
    },
  ]

  const labelsWithStatus = rows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  // Build pagination href preserving search/status params
  function pageHref(page: number) {
    const p = new URLSearchParams()
    if (page > 1) p.set('page', String(page))
    if (searchTerm) p.set('search', searchTerm)
    if (statusFilter) p.set('status', statusFilter)
    const qs = p.toString()
    return qs ? `/?${qs}` : '/'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labels"
        description="All label verification activity and review queue."
      />

      <StatsCards stats={stats} />

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          paramKey="search"
          basePath="/"
          placeholder="Search by brand name..."
          className="flex-1"
        />
        <FilterBar
          paramKey="status"
          basePath="/"
          options={STATUS_FILTERS.map((f) => ({
            label: f.label,
            value: f.value,
          }))}
        />
      </div>

      {/* Labels table */}
      {labelsWithStatus.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter
                ? 'No labels match your filters.'
                : 'No labels validated yet. Start by validating a label.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Brand Name</TableHead>
                <TableHead>Beverage Type</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labelsWithStatus.map((label) => {
                const isReviewable = REVIEWABLE_STATUSES.has(
                  label.effectiveStatus,
                )
                return (
                  <TableRow key={label.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={label.effectiveStatus} />
                        {label.isPriority && (
                          <Badge
                            variant="outline"
                            className="border-red-300 text-red-600 dark:border-red-800 dark:text-red-400"
                          >
                            Priority
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {label.brandName ?? 'Untitled'}
                    </TableCell>
                    <TableCell>
                      {BEVERAGE_TYPE_LABELS[label.beverageType] ??
                        label.beverageType}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {label.flaggedCount > 0 ? label.flaggedCount : '--'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatConfidence(label.overallConfidence)}
                    </TableCell>
                    <TableCell>
                      {formatDeadline(label.correctionDeadline)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(label.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={
                            isReviewable
                              ? `/review/${label.id}`
                              : `/labels/${label.id}`
                          }
                        >
                          {isReviewable ? 'Review' : 'View'}
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, tableTotal)}{' '}
                of {tableTotal} labels
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={pageHref(currentPage - 1)}>Previous</Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={pageHref(currentPage + 1)}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
