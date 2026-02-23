import { eq, count, and, desc, sql, ilike, type SQL } from 'drizzle-orm'
import { ShieldCheck } from 'lucide-react'

import { db } from '@/db'
import { labels, applicationData } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSLATargets } from '@/lib/settings/get-settings'
import { fetchSLAMetrics } from '@/lib/sla/queries'
import { getSLAStatus } from '@/lib/sla/status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { PageHeader } from '@/components/layout/page-header'
import {
  SLAMetricCards,
  type SLAMetricCardData,
} from '@/components/dashboard/sla-metric-card'
import { DashboardAnimatedShell } from '@/components/dashboard/dashboard-animated-shell'
import { SearchInput } from '@/components/shared/search-input'
import { FilterBar } from '@/components/shared/filter-bar'
import { LabelsTable } from '@/components/labels/labels-table'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Approved', value: 'approved' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'Conditionally Approved', value: 'conditionally_approved' },
  { label: 'Needs Correction', value: 'needs_correction' },
  { label: 'Rejected', value: 'rejected' },
] as const

interface HomePageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession()
  if (!session) return null

  const params = await searchParams
  const { user } = session

  const currentPage = Math.max(1, Number(params.page) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE
  const searchTerm = params.search?.trim() ?? ''
  const statusFilter = params.status ?? ''

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
  const tableWhere =
    tableConditions.length > 0 ? and(...tableConditions) : undefined

  const [slaMetrics, slaTargets, tableCountResult, rows] = await Promise.all([
    fetchSLAMetrics(),
    getSLATargets(),
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
        thumbnailUrl: sql<string | null>`(
          SELECT li.image_url FROM label_images li
          WHERE li.label_id = ${labels.id}
          AND li.image_type = 'front'
          ORDER BY li.sort_order
          LIMIT 1
        )`,
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
      .orderBy(desc(labels.isPriority), desc(labels.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / PAGE_SIZE)

  // Build SLA card data
  const slaCards: SLAMetricCardData[] = [
    {
      icon: 'Clock',
      label: 'Review Response Time',
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
      label: 'Auto-Approval Rate',
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
      value: slaMetrics.queueDepth,
      target: slaTargets.maxQueueDepth,
      unit: '',
      status: getSLAStatus(slaMetrics.queueDepth, slaTargets.maxQueueDepth),
    },
  ]

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
    <DashboardAnimatedShell
      header={
        <PageHeader
          title="Labels"
          description="All label verification activity and review queue."
        />
      }
      stats={<SLAMetricCards metrics={slaCards} />}
      filters={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            paramKey="search"
            placeholder="Search by brand name..."
            className="flex-1"
          />
          <FilterBar
            paramKey="status"
            options={STATUS_FILTERS.map((f) => ({
              label: f.label,
              value: f.value,
            }))}
          />
        </div>
      }
      table={
        labelsWithStatus.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16">
              <ShieldCheck className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchTerm || statusFilter
                  ? 'No labels match your filters.'
                  : 'No labels validated yet.'}
              </p>
              {!searchTerm && !statusFilter && (
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Start by validating a label.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <LabelsTable
            labels={labelsWithStatus}
            userRole={user.role}
            totalPages={totalPages}
            tableTotal={tableTotal}
            pageSize={PAGE_SIZE}
          />
        )
      }
    />
  )
}
