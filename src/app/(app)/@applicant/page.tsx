import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { routes } from '@/config/routes'
import { getApplicantByEmail } from '@/db/queries/applicants'
import { getApplicantLabelCount } from '@/db/queries/labels'
import { requireApplicant } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { AutoRefresh } from '@/components/shared/AutoRefresh'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { SearchInput } from '@/components/shared/SearchInput'
import { ResetFiltersButton } from '@/components/shared/ResetFiltersButton'
import {
  SubmissionsSummarySection,
  SummaryCardsSkeleton,
} from '@/components/submissions/SubmissionsSummarySection'
import {
  SubmissionsTableSection,
  SubmissionsTableSkeleton,
} from '@/components/submissions/SubmissionsTableSection'

export const metadata: Metadata = {
  title: 'Submissions',
}

interface ApplicantDashboardProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ApplicantDashboard({
  searchParams,
}: ApplicantDashboardProps) {
  await connection()
  const session = await requireApplicant()

  await searchParamsCache.parse(searchParams)
  const currentPage = Math.max(1, searchParamsCache.get('page'))
  const searchTerm = searchParamsCache.get('search')
  const sortKey = searchParamsCache.get('sort')
  const sortOrder = searchParamsCache.get('order') === 'asc' ? 'asc' : 'desc'
  const statusFilter = searchParamsCache.get('status')
  const beverageTypeFilter = searchParamsCache.get('beverageType')

  // Find applicant record by email
  const applicantRecord = await getApplicantByEmail(session.user.email)

  // No applicant record means no submissions — go straight to submit
  if (!applicantRecord) redirect(routes.submit())

  // Quick count check — redirect first-time applicants before rendering
  const total = await getApplicantLabelCount(applicantRecord.id)

  if (total === 0) redirect(routes.submit())

  return (
    <PageShell className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="My Submissions"
        description="Your submitted label applications and their verification results."
      />

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SubmissionsSummarySection applicantId={applicantRecord.id} />
      </Suspense>

      <div className="flex items-center gap-2">
        <SearchInput
          paramKey="search"
          placeholder="Search by name, serial number, or type..."
          className="flex-1"
        />
        <ResetFiltersButton paramKeys={['status', 'beverageType']} />
      </div>

      <Suspense fallback={<SubmissionsTableSkeleton />}>
        <SubmissionsTableSection
          applicantId={applicantRecord.id}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          beverageTypeFilter={beverageTypeFilter}
          sortKey={sortKey}
          sortOrder={sortOrder}
          currentPage={currentPage}
        />
      </Suspense>
      {/* Mobile FAB — quick access to new submission */}
      <Link
        href={routes.submit()}
        className="fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        aria-label="New submission"
      >
        <Plus className="size-6" />
      </Link>
    </PageShell>
  )
}
