import { cn } from '@/lib/utils'
import type { SLATargets } from '@/lib/settings/get-settings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export interface SLAMetrics {
  avgReviewResponseHours: number | null
  avgTotalTurnaroundHours: number | null
  autoApprovalRate: number | null
  queueDepth: number
}

interface SLAComplianceCardProps {
  targets: SLATargets
  metrics: SLAMetrics
}

type SLAStatus = 'green' | 'amber' | 'red'

function getStatus(
  actual: number,
  target: number,
  lowerIsBetter = true,
): SLAStatus {
  if (lowerIsBetter) {
    if (actual <= target) return 'green'
    if (actual <= target * 1.2) return 'amber'
    return 'red'
  }
  // Higher is better (e.g., auto-approval rate)
  if (actual >= target) return 'green'
  if (actual >= target * 0.8) return 'amber'
  return 'red'
}

const STATUS_COLORS: Record<SLAStatus, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
}

const STATUS_BG: Record<SLAStatus, string> = {
  green: 'bg-green-100 dark:bg-green-900/30',
  amber: 'bg-amber-100 dark:bg-amber-900/30',
  red: 'bg-red-100 dark:bg-red-900/30',
}

function SLARow({
  label,
  actual,
  target,
  unit,
  status,
}: {
  label: string
  actual: string
  target: string
  unit: string
  status: SLAStatus
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg px-4 py-3',
        STATUS_BG[status],
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            STATUS_COLORS[status],
          )}
        >
          {actual}
        </span>
        <span className="text-xs text-muted-foreground">
          / {target}
          {unit}
        </span>
      </div>
    </div>
  )
}

export function SLAComplianceCard({
  targets,
  metrics,
}: SLAComplianceCardProps) {
  const reviewStatus =
    metrics.avgReviewResponseHours !== null
      ? getStatus(metrics.avgReviewResponseHours, targets.reviewResponseHours)
      : 'green'

  const turnaroundStatus =
    metrics.avgTotalTurnaroundHours !== null
      ? getStatus(metrics.avgTotalTurnaroundHours, targets.totalTurnaroundHours)
      : 'green'

  const approvalStatus =
    metrics.autoApprovalRate !== null
      ? getStatus(
          metrics.autoApprovalRate,
          targets.autoApprovalRateTarget,
          false,
        )
      : 'green'

  const queueStatus = getStatus(metrics.queueDepth, targets.maxQueueDepth)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">SLA Compliance</CardTitle>
        <CardDescription>
          Actual performance vs configured targets (last 30 days).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <SLARow
          label="Review Response Time"
          actual={
            metrics.avgReviewResponseHours !== null
              ? `${Math.round(metrics.avgReviewResponseHours)}h`
              : '--'
          }
          target={String(targets.reviewResponseHours)}
          unit="h"
          status={reviewStatus}
        />
        <SLARow
          label="Total Turnaround"
          actual={
            metrics.avgTotalTurnaroundHours !== null
              ? `${Math.round(metrics.avgTotalTurnaroundHours)}h`
              : '--'
          }
          target={String(targets.totalTurnaroundHours)}
          unit="h"
          status={turnaroundStatus}
        />
        <SLARow
          label="Auto-Approval Rate"
          actual={
            metrics.autoApprovalRate !== null
              ? `${Math.round(metrics.autoApprovalRate)}%`
              : '--'
          }
          target={String(targets.autoApprovalRateTarget)}
          unit="%"
          status={approvalStatus}
        />
        <SLARow
          label="Queue Depth"
          actual={String(metrics.queueDepth)}
          target={String(targets.maxQueueDepth)}
          unit=""
          status={queueStatus}
        />
      </CardContent>
    </Card>
  )
}
