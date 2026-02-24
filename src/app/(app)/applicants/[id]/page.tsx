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

import { db } from '@/db'
import {
  applicants,
  labels,
  applicationData,
  statusOverrides,
} from '@/db/schema'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { requireSpecialist } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StatusBadge } from '@/components/shared/status-badge'
import { ApplicantLabelsTable } from '@/components/applicants/applicant-labels-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getRiskBadge(approvalRate: number | null) {
  if (approvalRate === null) {
    return (
      <Badge variant="secondary" className="text-xs">
        No data
      </Badge>
    )
  }

  if (approvalRate >= 90) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400">
        Low Risk
      </Badge>
    )
  }

  if (approvalRate >= 70) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400">
        Medium Risk
      </Badge>
    )
  }

  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-400">
      High Risk
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApplicantDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    status?: string
    sort?: string
    order?: string
    beverageType?: string
  }>
}

export default async function ApplicantDetailPage({
  params,
  searchParams,
}: ApplicantDetailPageProps) {
  await requireSpecialist()

  const { id } = await params
  const sp = await searchParams
  const statusFilter = sp.status
  const sortKey = sp.sort ?? ''
  const sortOrder = sp.order === 'asc' ? 'asc' : 'desc'
  const beverageTypeFilter = sp.beverageType ?? ''

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

  // Compute compliance stats (from unfiltered set)
  const totalLabels = allLabelsWithStatus.length
  const approvedCount = allLabelsWithStatus.filter(
    (l) => l.effectiveStatus === 'approved',
  ).length
  const approvalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : null
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
          <Link href="/applicants">
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
          {getRiskBadge(approvalRate)}
        </PageHeader>
      </div>

      {/* Compliance stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvalRate !== null ? `${approvalRate}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {approvedCount} of {totalLabels} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Submissions
            </CardTitle>
            <FileCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLabels}</div>
            <p className="text-xs text-muted-foreground">
              Labels submitted for verification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Last Submission
            </CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastSubmission ? formatDate(lastSubmission) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent label submission
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Top Override Reason
            </CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-2xl font-bold">
              {topOverrideReason ?? 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              Most common specialist override reason
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {applicant.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {applicant.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Label history */}
      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Label History
        </h2>

        {/* Status filter tabs */}
        {availableStatuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter ? 'ghost' : 'secondary'}
              size="sm"
              asChild
            >
              <Link href={`/applicants/${id}`}>All ({totalLabels})</Link>
            </Button>
            {availableStatuses.map((status) => {
              const statusCount = allLabelsWithStatus.filter(
                (l) => l.effectiveStatus === status,
              ).length
              return (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'secondary' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link href={`/applicants/${id}?status=${status}`}>
                    <StatusBadge status={status} className="mr-1" />(
                    {statusCount})
                  </Link>
                </Button>
              )
            })}
          </div>
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
