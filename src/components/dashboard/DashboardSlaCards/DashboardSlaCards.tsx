import { getSLATargets } from '@/db/queries/settings'
import { fetchSLAMetrics } from '@/db/queries/sla'
import { getSLAStatus } from '@/lib/sla/status'
import {
  SLAMetricCard,
  type SLAMetricCardData,
} from '@/components/dashboard/SlaMetricCard'
import { Skeleton } from '@/components/ui/Skeleton'

/** Convert hours to the best display unit: minutes if < 1h, hours otherwise. */
function formatDuration(hours: number | null): {
  value: number | null
  unit: string
} {
  if (hours === null) return { value: null, unit: 'h' }
  if (hours < 1) return { value: Math.round(hours * 60), unit: 'm' }
  return { value: Math.round(hours), unit: 'h' }
}

export function SLACardsSkeleton() {
  return (
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
  )
}

export async function DashboardSLACards() {
  const [slaMetrics, slaTargets] = await Promise.all([
    fetchSLAMetrics(),
    getSLATargets(),
  ])

  const slaCards: SLAMetricCardData[] = [
    {
      icon: 'Clock',
      label: 'Response Time',
      description:
        'Average time from label submission to first specialist review. Lower is better.',
      ...formatDuration(slaMetrics.avgReviewResponseHours),
      target: slaTargets.reviewResponseHours,
      targetUnit: 'h',
      status:
        slaMetrics.avgReviewResponseHours !== null
          ? getSLAStatus(
              slaMetrics.avgReviewResponseHours,
              slaTargets.reviewResponseHours,
            )
          : 'green',
    },
    {
      icon: 'Gauge',
      label: 'Total Turnaround',
      description:
        'Average time from submission to final decision (approved, rejected, or needs correction). Lower is better.',
      ...formatDuration(slaMetrics.avgTotalTurnaroundHours),
      target: slaTargets.totalTurnaroundHours,
      targetUnit: 'h',
      status:
        slaMetrics.avgTotalTurnaroundHours !== null
          ? getSLAStatus(
              slaMetrics.avgTotalTurnaroundHours,
              slaTargets.totalTurnaroundHours,
            )
          : 'green',
    },
    {
      icon: 'Zap',
      label: 'Approval Rate',
      description:
        'Percentage of labels approved automatically by AI without specialist review. Higher is better.',
      value: slaMetrics.autoApprovalRate,
      target: slaTargets.autoApprovalRateTarget,
      unit: '%',
      status:
        slaMetrics.autoApprovalRate !== null
          ? getSLAStatus(
              slaMetrics.autoApprovalRate,
              slaTargets.autoApprovalRateTarget,
              false,
            )
          : 'green',
    },
    {
      icon: 'Inbox',
      label: 'Queue Depth',
      description:
        'Number of labels waiting for specialist review. Lower means the team is keeping up with incoming submissions.',
      value: slaMetrics.queueDepth,
      target: slaTargets.maxQueueDepth,
      unit: '',
      status: getSLAStatus(slaMetrics.queueDepth, slaTargets.maxQueueDepth),
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {slaCards.map((metric, i) => (
        <SLAMetricCard key={metric.label} {...metric} index={i} />
      ))}
    </div>
  )
}
