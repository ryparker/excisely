import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure AI verification thresholds and field comparison rules."
      />

      {/* Confidence threshold card */}
      <Skeleton className="h-[200px] rounded-xl" />

      {/* Field strictness card */}
      <Skeleton className="h-[700px] rounded-xl" />
    </div>
  )
}
