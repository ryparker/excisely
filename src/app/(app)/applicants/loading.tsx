import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ApplicantsLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        description="Companies that have submitted labels for verification."
      >
        <Skeleton className="h-6 w-16 rounded-full" />
      </PageHeader>

      {/* Search skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-8 w-16" />
      </div>

      <Card className="py-0">
        {/* Table header */}
        <div className="border-b px-6 py-3">
          <div className="grid grid-cols-6 gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-6 items-center gap-4 px-6 py-3"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
