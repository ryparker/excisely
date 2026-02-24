import { Skeleton } from '@/components/ui/Skeleton'

export default function SpecialistLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* SLA metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-1.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter pills */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-18 rounded-full" />
        </div>
      </div>

      {/* Table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
