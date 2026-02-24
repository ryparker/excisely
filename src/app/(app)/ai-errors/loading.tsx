import { PageHeader } from '@/components/layout/PageHeader'
import { STAT_CARD_BASE } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function AIErrorsLoading() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Errors"
        description="Fields where specialist review disagreed with AI classification."
      />

      {/* Summary stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={STAT_CARD_BASE}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="mt-3 h-7 w-12" />
            <Skeleton className="mt-1.5 h-3 w-32" />
          </div>
        ))}
        <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      <div className="space-y-3">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
        </div>

        {/* Table skeleton */}
        <Card className="overflow-hidden py-0">
          <div className="border-b bg-muted/50 px-6 py-3">
            <div className="flex gap-6">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>

          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-6 py-3">
                <Skeleton className="h-4 w-12 shrink-0" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
