import { Skeleton } from '@/components/ui/skeleton'

export default function AppLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Content area */}
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
