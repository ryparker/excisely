import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReviewQueueLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Labels requiring specialist review and resolution."
      >
        <Skeleton className="h-6 w-[80px] rounded-full" />
      </PageHeader>

      <Card className="py-0">
        {/* Table header */}
        <div className="border-b px-6 py-3">
          <div className="grid grid-cols-7 gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-7 items-center gap-4 px-6 py-3"
            >
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-8 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
