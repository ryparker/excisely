import { Skeleton } from '@/components/ui/skeleton'

export default function ValidationDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Summary card skeleton */}
      <Skeleton className="h-20 rounded-xl" />

      {/* Two-panel layout skeleton */}
      <div className="flex gap-6">
        {/* Left panel — image */}
        <div className="w-[55%] shrink-0">
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>

        {/* Right panel — field comparisons */}
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Report skeleton */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
