import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, desc, sql } from 'drizzle-orm'
import {
  ArrowLeft,
  ArrowRight,
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
  validationItems,
  validationResults,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BEVERAGE_TYPE_LABELS: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
}

const FIELD_NAME_LABELS: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning Statement',
  name_and_address: 'Name and Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation of Origin',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Declaration',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
  standards_of_fill: 'Standards of Fill',
}

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
  searchParams: Promise<{ status?: string }>
}

export default async function ApplicantDetailPage({
  params,
  searchParams,
}: ApplicantDetailPageProps) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params
  const { status: statusFilter } = await searchParams

  // Fetch the applicant
  const [applicant] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, id))
    .limit(1)

  if (!applicant) {
    notFound()
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
    .where(eq(labels.applicantId, id))
    .orderBy(desc(labels.createdAt))

  // Compute effective statuses
  const labelsWithStatus = labelRows.map((row) => ({
    ...row,
    effectiveStatus: getEffectiveStatus({
      status: row.status,
      correctionDeadline: row.correctionDeadline,
      deadlineExpired: row.deadlineExpired,
    }),
  }))

  // Compute compliance stats
  const totalLabels = labelsWithStatus.length
  const approvedCount = labelsWithStatus.filter(
    (l) => l.effectiveStatus === 'approved',
  ).length
  const approvalRate =
    totalLabels > 0 ? Math.round((approvedCount / totalLabels) * 100) : null
  const lastSubmission =
    labelsWithStatus.length > 0 ? labelsWithStatus[0].createdAt : null

  // Find most common rejection reason via validation items
  const rejectionReasonRows = await db
    .select({
      fieldName: validationItems.fieldName,
      count: sql<number>`count(*)`,
    })
    .from(validationItems)
    .innerJoin(
      validationResults,
      eq(validationItems.validationResultId, validationResults.id),
    )
    .innerJoin(labels, eq(validationResults.labelId, labels.id))
    .where(
      and(
        eq(labels.applicantId, id),
        sql`${validationItems.status} IN ('mismatch', 'not_found', 'needs_correction')`,
      ),
    )
    .groupBy(validationItems.fieldName)
    .orderBy(sql`count(*) desc`)
    .limit(1)

  const topRejectionReason = rejectionReasonRows[0]
    ? (FIELD_NAME_LABELS[rejectionReasonRows[0].fieldName] ??
      rejectionReasonRows[0].fieldName)
    : null

  // Apply status filter
  const filteredLabels = statusFilter
    ? labelsWithStatus.filter((l) => l.effectiveStatus === statusFilter)
    : labelsWithStatus

  // Collect unique statuses for filter tabs
  const availableStatuses = [
    ...new Set(labelsWithStatus.map((l) => l.effectiveStatus)),
  ].sort()

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-sm font-medium">Top Issue</CardTitle>
            <Building2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-2xl font-bold">
              {topRejectionReason ?? 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              Most common flagged field
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
              const statusCount = labelsWithStatus.filter(
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
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Beverage Type</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabels.map((label) => (
                  <TableRow key={label.id}>
                    <TableCell>
                      <StatusBadge status={label.effectiveStatus} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {label.brandName ?? 'Untitled'}
                    </TableCell>
                    <TableCell>
                      {BEVERAGE_TYPE_LABELS[label.beverageType] ??
                        label.beverageType}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatConfidence(label.overallConfidence)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(label.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/labels/${label.id}`}>
                          View
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}
