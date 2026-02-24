import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Building2 } from 'lucide-react'

import { getApplicantsWithStats } from '@/db/queries/applicants'
import { requireSpecialist } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { REASON_CODE_LABELS } from '@/config/override-reasons'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { SearchInput } from '@/components/shared/SearchInput'
import { ResetFiltersButton } from '@/components/shared/ResetFiltersButton'
import { ApplicantsTable } from '@/components/applicants/ApplicantsTable'
import { Card, CardContent } from '@/components/ui/Card'

export const metadata: Metadata = {
  title: 'Applicants',
}

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
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ApplicantsPage({
  searchParams,
}: ApplicantsPageProps) {
  await connection()
  await requireSpecialist()

  await searchParamsCache.parse(searchParams)
  const page = Math.max(1, searchParamsCache.get('page'))
  const searchTerm = searchParamsCache.get('search')
  const sortKey = searchParamsCache.get('sort')
  const sortOrder = searchParamsCache.get('order') === 'asc' ? 'asc' : 'desc'
  const riskFilter = searchParamsCache.get('risk')

  const rows = await getApplicantsWithStats({
    searchTerm: searchTerm || undefined,
    sortKey: sortKey || undefined,
    sortOrder,
  })

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
