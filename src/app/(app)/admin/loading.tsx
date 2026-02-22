import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Team performance overview and operational metrics."
      />

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>

      {/* Specialist table */}
      <Skeleton className="h-[320px] rounded-xl" />

      {/* Flagged applicants table */}
      <Skeleton className="h-[280px] rounded-xl" />
    </div>
  )
}
