import { Skeleton } from '@/components/ui/skeleton'

export default function BatchDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Progress bar */}
      <Skeleton className="h-20 rounded-xl" />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Results table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
