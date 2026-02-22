import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  approved: {
    label: 'Approved',
    className: 'bg-success text-success-foreground hover:bg-success/90',
  },
  conditionally_approved: {
    label: 'Conditionally Approved',
    className: 'bg-warning text-warning-foreground hover:bg-warning/90',
  },
  needs_correction: {
    label: 'Needs Correction',
    className:
      'bg-orange-500 text-white hover:bg-orange-500/90 dark:bg-orange-600',
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60',
  },
  processing: {
    label: 'Processing',
    className: 'bg-blue-500 text-white hover:bg-blue-500/90 dark:bg-blue-600',
  },
  pending: {
    label: 'Pending',
    className: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending

  return (
    <Badge className={cn(config.className, className)}>{config.label}</Badge>
  )
}
