import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function RegulationsLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Regulations Reference"
        description="27 CFR labeling requirements for alcohol beverages"
      />

      {/* Search + tabs skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-md" />
          ))}
        </div>
      </div>

      {/* Count skeleton */}
      <Skeleton className="h-4 w-24" />

      {/* Part header skeleton */}
      <div className="space-y-4">
        <div>
          <Skeleton className="mb-1 h-6 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>

        {/* Section card skeletons */}
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>
              <div className="mt-3 space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="mt-3 flex gap-1.5 border-t pt-3">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
