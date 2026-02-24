import type { Metadata } from 'next'
import { connection } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileCheck,
  TrendingUp,
} from 'lucide-react'

import { routes } from '@/config/routes'
import {
  getApplicantById,
  getApplicantCompanyName,
  getTopOverrideReason,
} from '@/db/queries/applicants'
import { getStatusCounts, getApplicantDetailLabels } from '@/db/queries/labels'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { requireSpecialist } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { formatDate } from '@/lib/utils'
import { STATUS_LABELS } from '@/config/status-config'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatCard } from '@/components/shared/StatCard'
import { ApplicantLabelsTable } from '@/components/applicants/ApplicantLabelsTable'
import { ApplicantNotes } from '@/components/applicants/ApplicantNotes'
import { RiskBadge } from '@/components/applicants/RiskBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const companyName = await getApplicantCompanyName(id)
  return { title: companyName ?? 'Applicant Detail' }
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
  const applicant = await getApplicantById(id)

  if (!applicant) {
    notFound()
  }

  // Fetch labels + status counts + top override reason in parallel
  const [labelRows, statusCountRows, topOverrideReasonCode] = await Promise.all(
    [
      getApplicantDetailLabels(id, {
        beverageTypeFilter: beverageTypeFilter || undefined,
        sortKey,
        sortOrder,
      }),
      getStatusCounts(id),
      getTopOverrideReason(id),
    ],
  )

  // Compute effective statuses
  const labelsWithStatus = labelRows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  // For stats we need the full (unfiltered) set — use status counts from centralized query
  const statusCounts: Record<string, number> = {}
  let totalLabels = 0
  for (const row of statusCountRows) {
    statusCounts[row.status] = row.count
    totalLabels += row.count
  }

  // Compute compliance stats from status counts
  const REVIEWED_STATUSES = [
    'approved',
    'needs_correction',
    'conditionally_approved',
    'rejected',
  ]
  const approvedCount = statusCounts['approved'] ?? 0
  const reviewedCount = REVIEWED_STATUSES.reduce(
    (sum, s) => sum + (statusCounts[s] ?? 0),
    0,
  )
  const approvalRate =
    reviewedCount > 0 ? Math.round((approvedCount / reviewedCount) * 100) : null

  // For "all labels" stats we use the full unfiltered set
  // If beverage type filter is active, we need to get all labels for the filter tabs
  const allLabelsWithStatus = beverageTypeFilter
    ? (await getApplicantDetailLabels(id)).map((row) => ({
        ...row,
        effectiveStatus: getEffectiveStatus({
          status: row.status,
          correctionDeadline: row.correctionDeadline,
          deadlineExpired: row.deadlineExpired,
        }),
      }))
    : labelsWithStatus

  const lastSubmission =
    allLabelsWithStatus.length > 0 ? allLabelsWithStatus[0].createdAt : null

  const topOverrideReason = topOverrideReasonCode
    ? (REASON_CODE_LABELS[topOverrideReasonCode] ?? topOverrideReasonCode)
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
      <Section>
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
            description={`${approvedCount} of ${reviewedCount} reviewed approved`}
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
      </Section>

      {/* Notes */}
      <Section>
        <ApplicantNotes
          applicantId={applicant.id}
          initialNotes={applicant.notes}
        />
      </Section>

      {/* Label history */}
      <Section title="Label History">
        <div className="space-y-4">
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
                    status === 'needs_correction' ||
                    status === 'pending_review',
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
      </Section>
    </PageShell>
  )
}
