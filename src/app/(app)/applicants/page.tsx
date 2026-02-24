import type { Metadata } from 'next'
import { desc, asc, eq, sql, count } from 'drizzle-orm'
import { Building2 } from 'lucide-react'

import { db } from '@/db'
import { applicants, labels } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { parsePageSearchParams } from '@/lib/search-params'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { SearchInput } from '@/components/shared/search-input'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'
import { ApplicantsTable } from '@/components/applicants/applicants-table'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Applicants',
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    page?: string
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
  const {
    currentPage: page,
    searchTerm,
    sortKey,
    sortOrder,
  } = parsePageSearchParams(params)
  const riskFilter = params.risk ?? ''

  // Computed columns for sorting
  // Approval rate only considers reviewed labels (terminal statuses),
  // not pending/processing labels that haven't been evaluated yet.
  const reviewedCountSql = sql<number>`count(case when ${labels.status} in ('approved', 'needs_correction', 'conditionally_approved', 'rejected') then 1 end)`
  const approvalRateSql = sql<number>`
    CASE WHEN ${reviewedCountSql} > 0
    THEN round((count(case when ${labels.status} = 'approved' then 1 end)::numeric / ${reviewedCountSql}) * 100)
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
      reviewedCount: sql<number>`count(case when ${labels.status} in ('approved', 'needs_correction', 'conditionally_approved', 'rejected') then 1 end)`,
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
    const reviewedCount = row.reviewedCount ?? 0
    const approvalRate =
      reviewedCount > 0
        ? Math.round((row.approvedCount / reviewedCount) * 100)
        : null
    const topReason = row.topOverrideReason
      ? (REASON_CODE_LABELS[row.topOverrideReason] ?? row.topOverrideReason)
      : null
    return { ...row, approvalRate, topReason }
  })

  // Apply risk filter (computed from approval rate)
  const filteredApplicants = riskFilter
    ? applicantsWithStats.filter(
        (a) => getRiskLevel(a.approvalRate) === riskFilter,
      )
    : applicantsWithStats

  // Paginate
  const tableTotal = filteredApplicants.length
  const totalPages = Math.max(1, Math.ceil(tableTotal / PAGE_SIZE))
  const paginatedApplicants = filteredApplicants.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Companies that have submitted labels for verification."
      />

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
        <ApplicantsTable
          rows={paginatedApplicants}
          totalPages={totalPages}
          tableTotal={tableTotal}
          pageSize={PAGE_SIZE}
          searchTerm={searchTerm}
        />
      )}
    </PageShell>
  )
}
