import Link from 'next/link'
import { desc, asc, eq, sql, count } from 'drizzle-orm'
import { ArrowRight, Building2 } from 'lucide-react'

import { db } from '@/db'
import { applicants, labels } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ColumnHeader } from '@/components/shared/column-header'
import { Highlight } from '@/components/shared/highlight'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { SearchInput } from '@/components/shared/search-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
// Constants
// ---------------------------------------------------------------------------

const RISK_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Low Risk', value: 'low' },
  { label: 'Medium Risk', value: 'medium' },
  { label: 'High Risk', value: 'high' },
]

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

function getRiskLevel(approvalRate: number | null): string {
  if (approvalRate === null) return 'none'
  if (approvalRate >= 90) return 'low'
  if (approvalRate >= 70) return 'medium'
  return 'high'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ApplicantsPageProps {
  searchParams: Promise<{
    search?: string
    sort?: string
    order?: string
    risk?: string
  }>
}

export default async function ApplicantsPage({
  searchParams,
}: ApplicantsPageProps) {
  await requireSpecialist()

  const params = await searchParams
  const searchTerm = params.search?.trim() ?? ''
  const sortKey = params.sort ?? ''
  const sortOrder = params.order === 'asc' ? 'asc' : 'desc'
  const riskFilter = params.risk ?? ''

  // Computed columns for sorting
  const approvalRateSql = sql<number>`
    CASE WHEN count(${labels.id}) > 0
    THEN round((count(case when ${labels.status} = 'approved' then 1 end)::numeric / count(${labels.id})) * 100)
    ELSE 0 END
  `
  const totalLabelsSql = count(labels.id)
  const lastSubmissionSql = sql<Date | null>`max(${labels.createdAt})`

  // Map sort keys to columns
  const SORT_COLUMNS: Record<
    string,
    ReturnType<typeof sql> | typeof applicants.companyName
  > = {
    companyName: applicants.companyName,
    totalLabels: totalLabelsSql,
    approvalRate: approvalRateSql,
    lastSubmission: lastSubmissionSql,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = desc(applicants.createdAt)
  }

  // Query applicants with aggregated label stats
  const rows = await db
    .select({
      id: applicants.id,
      companyName: applicants.companyName,
      contactEmail: applicants.contactEmail,
      createdAt: applicants.createdAt,
      totalLabels: totalLabelsSql,
      approvedCount: sql<number>`count(case when ${labels.status} = 'approved' then 1 end)`,
      lastSubmission: lastSubmissionSql,
      topOverrideReason: sql<string | null>`(
        SELECT so.reason_code FROM status_overrides so
        INNER JOIN labels l ON so.label_id = l.id
        WHERE l.applicant_id = ${applicants.id}
        AND so.reason_code IS NOT NULL
        AND so.new_status IN ('rejected', 'needs_correction')
        GROUP BY so.reason_code
        ORDER BY count(*) DESC
        LIMIT 1
      )`,
    })
    .from(applicants)
    .leftJoin(labels, eq(applicants.id, labels.applicantId))
    .where(
      searchTerm
        ? sql`lower(${applicants.companyName}) like ${`%${searchTerm.toLowerCase()}%`}`
        : undefined,
    )
    .groupBy(applicants.id)
    .orderBy(orderByClause)

  const applicantsWithStats = rows.map((row) => {
    const approvalRate =
      row.totalLabels > 0
        ? Math.round((row.approvedCount / row.totalLabels) * 100)
        : null
    const topReason = row.topOverrideReason
      ? (REASON_CODE_LABELS[row.topOverrideReason] ?? row.topOverrideReason)
      : null
    return { ...row, approvalRate, topReason }
  })

  // Apply client-side risk filter (computed from approval rate)
  const filteredApplicants = riskFilter
    ? applicantsWithStats.filter(
        (a) => getRiskLevel(a.approvalRate) === riskFilter,
      )
    : applicantsWithStats

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Companies that have submitted labels for verification."
      >
        <Badge variant="secondary" className="text-sm">
          {applicantsWithStats.length} total
        </Badge>
      </PageHeader>

      {/* Search + Reset */}
      <div className="flex items-center gap-2">
        <SearchInput
          paramKey="search"
          placeholder="Search by company name..."
          className="max-w-sm flex-1"
        />
        <ResetFiltersButton paramKeys={['risk', 'sort', 'order']} />
      </div>

      {filteredApplicants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchTerm || riskFilter
                ? 'No applicants found matching your filters.'
                : 'No applicants yet. Applicants are created when submitting labels for verification.'}
            </p>
            {(searchTerm || riskFilter) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different search term or clear the filters.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-clip py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <ColumnHeader sortKey="companyName">Company Name</ColumnHeader>
                <ColumnHeader sortKey="totalLabels" className="text-right">
                  Total Labels
                </ColumnHeader>
                <ColumnHeader sortKey="approvalRate" className="text-right">
                  Approval Rate
                </ColumnHeader>
                <ColumnHeader filterKey="risk" filterOptions={RISK_OPTIONS}>
                  Risk
                </ColumnHeader>
                <TableHead>Top Reason</TableHead>
                <ColumnHeader sortKey="lastSubmission" defaultSort="desc">
                  Last Submission
                </ColumnHeader>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplicants.map((applicant) => (
                <TableRow key={applicant.id}>
                  <TableCell className="font-medium">
                    <Highlight
                      text={applicant.companyName}
                      query={searchTerm}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {applicant.totalLabels}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {applicant.approvalRate !== null
                      ? `${applicant.approvalRate}%`
                      : '--'}
                  </TableCell>
                  <TableCell>{getRiskBadge(applicant.approvalRate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {applicant.topReason ?? '--'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {applicant.lastSubmission
                      ? formatDate(new Date(applicant.lastSubmission))
                      : '--'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/applicants/${applicant.id}`}>
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
    </PageShell>
  )
}
