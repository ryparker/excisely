'use client'

import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  approved: {
    label: 'Approved',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  conditionally_approved: {
    label: 'Conditionally Approved',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
  },
  needs_correction: {
    label: 'Needs Correction',
    className:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-400',
  },
  rejected: {
    label: 'Rejected',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400',
  },
  pending_review: {
    label: 'Pending Review',
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400',
  },
  processing: {
    label: 'Processing',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
  },
  pending: {
    label: 'Pending',
    className: 'border-border bg-secondary text-secondary-foreground',
  },
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending:
    'Received and queued. The AI pipeline will begin processing shortly.',
  processing:
    'AI analysis in progress — OCR extraction and field classification typically takes 6-9 seconds.',
  pending_review:
    'AI analysis complete. A labeling specialist will review the field comparisons and make a determination.',
  approved:
    'This label has been approved. No further action needed unless a re-analysis is requested.',
  conditionally_approved:
    'Approved with conditions. The applicant has a 7-day window to submit corrections for flagged fields.',
  needs_correction:
    'Issues identified that require applicant corrections. A 30-day correction window has been set.',
  rejected:
    'This label application has been rejected. The applicant has been notified with the reasons.',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const description = STATUS_DESCRIPTIONS[status]

  const badge = (
    <Badge
      variant="outline"
      className={cn('font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )

  if (!description) return badge

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="cursor-help">{badge}</span>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-64">
        <p className="text-xs leading-relaxed">{description}</p>
      </HoverCardContent>
    </HoverCard>
  )
}
