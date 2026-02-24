import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SubmitLoading() {
  return (
    <div className="space-y-6">
      {/* Tab navigation skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Form card skeleton */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Upload area skeleton */}
          <Skeleton className="h-48 rounded-xl" />

          {/* Form fields skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 rounded-md" />
              </div>
            ))}
          </div>

          {/* Submit button skeleton */}
          <Skeleton className="h-10 w-32" />
        </div>
      </Card>
    </div>
  )
}
