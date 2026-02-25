import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { requireSpecialist } from '@/lib/auth/require-role'
import { searchParamsCache } from '@/lib/search-params-cache'
import { Section } from '@/components/shared/Section'
import { DashboardAnimatedShell } from '@/components/dashboard/DashboardAnimatedShell'
import {
  DashboardSLACards,
  SLACardsSkeleton,
} from '@/components/dashboard/DashboardSlaCards'
import {
  DashboardLabelsTable,
  TableSkeleton,
} from '@/components/dashboard/DashboardLabelsTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { ResetFiltersButton } from '@/components/shared/ResetFiltersButton'

export const metadata: Metadata = {
  title: 'Dashboard',
}

interface SpecialistDashboardProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SpecialistDashboard({
  searchParams,
}: SpecialistDashboardProps) {
  await connection()
  const session = await requireSpecialist()
  const { user } = session

  await searchParamsCache.parse(searchParams)
  const currentPage = Math.max(1, searchParamsCache.get('page'))
  const searchTerm = searchParamsCache.get('search')
  const sortKey = searchParamsCache.get('sort')
  const sortOrder = searchParamsCache.get('order') === 'asc' ? 'asc' : 'desc'

  // Default to "Pending Review" so specialists see actionable items first.
  const statusParam = searchParamsCache.get('status') || 'pending_review'

  // "ready_to_approve" is a virtual status that maps to queue=ready
  let statusFilter = ''
  let queueFilter = ''
  if (statusParam === 'ready_to_approve') {
    queueFilter = 'ready'
  } else if (statusParam !== 'all') {
    statusFilter = statusParam
  }
  // Legacy: support ?queue= param directly
  if (!queueFilter) {
    const queueParam = searchParamsCache.get('queue')
    if (queueParam) queueFilter = queueParam
  }

  const beverageTypeFilter = searchParamsCache.get('beverageType')

  return (
    <DashboardAnimatedShell
      header={
        <PageHeader
          title="Label Applications"
          description="All label verification activity and review queue."
        />
      }
      stats={
        <Section>
          <Suspense fallback={<SLACardsSkeleton />}>
            <DashboardSLACards />
          </Suspense>
        </Section>
      }
      filters={
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SearchInput
              paramKey="search"
              placeholder="Search by brand name..."
              className="flex-1"
            />
            <ResetFiltersButton
              paramKeys={['status', 'beverageType', 'queue']}
            />
          </div>
          <Section>
            <Suspense fallback={<TableSkeleton />}>
              <DashboardLabelsTable
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                queueFilter={queueFilter}
                beverageTypeFilter={beverageTypeFilter}
                sortKey={sortKey}
                sortOrder={sortOrder}
                currentPage={currentPage}
                userRole={user.role}
              />
            </Suspense>
          </Section>
        </div>
      }
      table={null}
    />
  )
}
