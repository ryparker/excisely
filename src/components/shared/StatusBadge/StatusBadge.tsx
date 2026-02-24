'use client'

import { Badge } from '@/components/ui/Badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import { STATUS_CONFIG, STATUS_DESCRIPTIONS } from '@/config/status-config'
import { cn } from '@/lib/utils'

export { STATUS_CONFIG, STATUS_LABELS } from '@/config/status-config'

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
