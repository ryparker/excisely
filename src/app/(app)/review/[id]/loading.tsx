import { Skeleton } from '@/components/ui/skeleton'

export default function ReviewDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-8 w-44" />

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>

      {/* Summary card skeleton */}
      <Skeleton className="h-20 rounded-xl" />

      {/* Two-panel layout skeleton */}
      <div className="flex gap-6">
        {/* Left panel — image */}
        <div className="w-[55%] shrink-0">
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>

        {/* Right panel — review field list */}
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-28 rounded-xl" />
              <div className="ml-4 flex gap-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
          <Skeleton className="h-12 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
