import type { Metadata } from 'next'
import { Suspense } from 'react'

import { requireSpecialist } from '@/lib/auth/require-role'
import { parsePageSearchParams } from '@/lib/search-params'
import { DashboardAnimatedShell } from '@/components/dashboard/dashboard-animated-shell'
import {
  DashboardSLACards,
  SLACardsSkeleton,
} from '@/components/dashboard/dashboard-sla-cards'
import {
  DashboardLabelsTable,
  TableSkeleton,
} from '@/components/dashboard/dashboard-labels-table'
import { PageHeader } from '@/components/layout/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { ResetFiltersButton } from '@/components/shared/reset-filters-button'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export const dynamic = 'force-dynamic'

interface SpecialistDashboardProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    queue?: string
    sort?: string
    order?: string
    beverageType?: string
  }>
}

export default async function SpecialistDashboard({
  searchParams,
}: SpecialistDashboardProps) {
  const session = await requireSpecialist()

  const params = await searchParams
  const { user } = session

  const { currentPage, searchTerm, sortKey, sortOrder } =
    parsePageSearchParams(params)
  // Default to "Pending Review" so specialists see actionable items first.
  const statusParam = params.status ?? 'pending_review'

  // "ready_to_approve" is a virtual status that maps to queue=ready
  let statusFilter = ''
  let queueFilter = ''
  if (statusParam === 'ready_to_approve') {
    queueFilter = 'ready'
  } else if (statusParam !== 'all') {
    statusFilter = statusParam
  }
  // Legacy: support ?queue= param directly
  if (!queueFilter && params.queue) {
    queueFilter = params.queue
  }

  const beverageTypeFilter = params.beverageType ?? ''

  return (
    <DashboardAnimatedShell
      header={
        <PageHeader
          title="Labels"
          description="All label verification activity and review queue."
        />
      }
      stats={
        <Suspense fallback={<SLACardsSkeleton />}>
          <DashboardSLACards />
        </Suspense>
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
        </div>
      }
      table={null}
    />
  )
}
