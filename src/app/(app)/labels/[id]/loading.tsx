import { Skeleton } from '@/components/ui/Skeleton'

export default function ValidationDetailLoading() {
  return (
    <div className="space-y-5">
      {/* Back link + header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Timeline skeleton */}
      <Skeleton className="h-16 rounded-lg" />

      {/* Summary strip skeleton */}
      <Skeleton className="h-20 rounded-lg" />

      {/* Two-panel layout — responsive like the actual page */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="shrink-0 lg:w-[55%]">
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
