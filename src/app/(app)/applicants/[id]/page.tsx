import type { Metadata } from 'next'
import { connection } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, desc, asc, sql } from 'drizzle-orm'
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileCheck,
  TrendingUp,
} from 'lucide-react'

import { routes } from '@/config/routes'
import { db } from '@/db'
import {
  applicants,
  labels,
  applicationData,
  statusOverrides,
} from '@/db/schema'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { requireSpecialist } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { formatDate } from '@/lib/utils'
import { STATUS_LABELS } from '@/config/status-config'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { FilterBar } from '@/components/shared/filter-bar'
import { StatCard } from '@/components/shared/stat-card'
import { ApplicantLabelsTable } from '@/components/applicants/applicant-labels-table'
import { ApplicantNotes } from '@/components/applicants/applicant-notes'
import { RiskBadge } from '@/components/applicants/risk-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const [row] = await db
    .select({ companyName: applicants.companyName })
    .from(applicants)
    .where(eq(applicants.id, id))
    .limit(1)
  return { title: row?.companyName ?? 'Applicant Detail' }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApplicantDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ApplicantDetailPage({
  params,
  searchParams,
}: ApplicantDetailPageProps) {
  await connection()
  await requireSpecialist()

  const { id } = await params
  await searchParamsCache.parse(searchParams)
  const statusFilter = searchParamsCache.get('status') || undefined
  const sortKey = searchParamsCache.get('sort')
  const sortOrder = searchParamsCache.get('order') === 'asc' ? 'asc' : 'desc'
  const beverageTypeFilter = searchParamsCache.get('beverageType')

  // Fetch the applicant
  const [applicant] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, id))
    .limit(1)

  if (!applicant) {
    notFound()
  }

  // Build where conditions
  const conditions = [eq(labels.applicantId, id)]
  if (beverageTypeFilter) {
    conditions.push(
      eq(
        labels.beverageType,
        beverageTypeFilter as (typeof labels.beverageType.enumValues)[number],
      ),
    )
  }

  // Map sort keys to DB columns
  const SORT_COLUMNS: Record<
    string,
    | typeof labels.createdAt
    | typeof applicationData.brandName
    | typeof labels.beverageType
    | typeof labels.overallConfidence
  > = {
    brandName: applicationData.brandName,
    beverageType: labels.beverageType,
    overallConfidence: labels.overallConfidence,
    createdAt: labels.createdAt,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = desc(labels.createdAt)
  }

  // Fetch all labels for this applicant
  const labelRows = await db
    .select({
      id: labels.id,
      status: labels.status,
      beverageType: labels.beverageType,
      overallConfidence: labels.overallConfidence,
      correctionDeadline: labels.correctionDeadline,
      deadlineExpired: labels.deadlineExpired,
      createdAt: labels.createdAt,
      brandName: applicationData.brandName,
    })
    .from(labels)
    .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
    .where(and(...conditions))
    .orderBy(orderByClause)

  // Compute effective statuses
  const labelsWithStatus = labelRows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  // For stats we need the full (unfiltered) set
  const allLabelRows = beverageTypeFilter
    ? await db
        .select({
          id: labels.id,
          status: labels.status,
          correctionDeadline: labels.correctionDeadline,
          deadlineExpired: labels.deadlineExpired,
          createdAt: labels.createdAt,
        })
        .from(labels)
        .where(eq(labels.applicantId, id))
        .orderBy(desc(labels.createdAt))
    : labelRows

  const allLabelsWithStatus = beverageTypeFilter
    ? allLabelRows.map((row) => ({
        ...row,
        effectiveStatus: getEffectiveStatus({
          status: row.status,
          correctionDeadline: row.correctionDeadline,
          deadlineExpired: row.deadlineExpired,
        }),
      }))
    : labelsWithStatus

  // Compute compliance stats from reviewed labels only (exclude pending/processing)
  const REVIEWED_STATUSES = new Set([
    'approved',
    'needs_correction',
    'conditionally_approved',
    'rejected',
  ])
  const totalLabels = allLabelsWithStatus.length
  const reviewedLabels = allLabelsWithStatus.filter((l) =>
    REVIEWED_STATUSES.has(l.effectiveStatus),
  )
  const approvedCount = reviewedLabels.filter(
    (l) => l.effectiveStatus === 'approved',
  ).length
  const approvalRate =
    reviewedLabels.length > 0
      ? Math.round((approvedCount / reviewedLabels.length) * 100)
      : null
  const lastSubmission =
    allLabelsWithStatus.length > 0 ? allLabelRows[0].createdAt : null

  // Find most common override reason code for this applicant
  const overrideReasonRows = await db
    .select({
      reasonCode: statusOverrides.reasonCode,
      count: sql<number>`count(*)`,
    })
    .from(statusOverrides)
    .innerJoin(labels, eq(statusOverrides.labelId, labels.id))
    .where(
      and(
        eq(labels.applicantId, id),
        sql`${statusOverrides.reasonCode} IS NOT NULL`,
        sql`${statusOverrides.newStatus} IN ('rejected', 'needs_correction')`,
      ),
    )
    .groupBy(statusOverrides.reasonCode)
    .orderBy(sql`count(*) desc`)
    .limit(1)

  const topOverrideReason = overrideReasonRows[0]?.reasonCode
    ? (REASON_CODE_LABELS[overrideReasonRows[0].reasonCode] ??
      overrideReasonRows[0].reasonCode)
    : null

  // Apply status filter (from tab buttons)
  const filteredLabels = statusFilter
    ? labelsWithStatus.filter((l) => l.effectiveStatus === statusFilter)
    : labelsWithStatus

  // Collect unique statuses for filter tabs (from unfiltered set)
  const availableStatuses = [
    ...new Set(allLabelsWithStatus.map((l) => l.effectiveStatus)),
  ].sort()

  return (
    <PageShell className="space-y-6">
      {/* Back link + header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={routes.applicants()}>
            <ArrowLeft className="size-4" />
            Back to Applicants
          </Link>
        </Button>

        <PageHeader
          title={applicant.companyName}
          description={
            [applicant.contactName, applicant.contactEmail]
              .filter(Boolean)
              .join(' — ') || undefined
          }
        >
          <RiskBadge approvalRate={approvalRate} />
        </PageHeader>
      </div>

      {/* Compliance stats cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          iconBg={
            approvalRate === null
              ? 'bg-muted'
              : approvalRate >= 90
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : approvalRate >= 70
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
          }
          iconColor={
            approvalRate === null
              ? 'text-muted-foreground'
              : approvalRate >= 90
                ? 'text-emerald-600 dark:text-emerald-400'
                : approvalRate >= 70
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
          }
          label="Approval Rate"
          value={approvalRate !== null ? `${approvalRate}%` : '--'}
          description={`${approvedCount} of ${reviewedLabels.length} reviewed approved`}
        />
        <StatCard
          icon={FileCheck}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Total Submissions"
          value={totalLabels}
          description="Labels submitted for verification"
        />
        <StatCard
          icon={Calendar}
          iconBg="bg-muted"
          iconColor="text-muted-foreground"
          label="Last Submission"
          value={lastSubmission ? formatDate(lastSubmission) : '--'}
          description="Most recent label submission"
        />
        <StatCard
          icon={Building2}
          iconBg="bg-muted"
          iconColor="text-muted-foreground"
          label="Top Override Reason"
          value={topOverrideReason ?? 'None'}
          description="Most common specialist override reason"
          valueClassName="truncate"
        />
      </div>

      {/* Notes */}
      <ApplicantNotes
        applicantId={applicant.id}
        initialNotes={applicant.notes}
      />

      {/* Label history */}
      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Label History
        </h2>

        {/* Status filter pills */}
        {availableStatuses.length > 0 && (
          <FilterBar
            paramKey="status"
            options={[
              { label: 'All', value: '', count: totalLabels },
              ...availableStatuses.map((status) => ({
                label: STATUS_LABELS[status] ?? status,
                value: status,
                count: allLabelsWithStatus.filter(
                  (l) => l.effectiveStatus === status,
                ).length,
                attention:
                  status === 'needs_correction' || status === 'pending_review',
              })),
            ]}
          />
        )}

        {filteredLabels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                {statusFilter
                  ? `No labels with status "${statusFilter}" for this applicant.`
                  : 'No labels have been submitted for this applicant yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ApplicantLabelsTable labels={filteredLabels} />
        )}
      </div>
    </PageShell>
  )
}
