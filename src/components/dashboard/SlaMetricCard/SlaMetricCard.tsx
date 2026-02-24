'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Clock, Gauge, Zap, Inbox, Info, type LucideIcon } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import { useCountUp } from '@/hooks/useCountUp'
import { staggerInitial, staggerTransitionSafe } from '@/lib/motion-presets'
import {
  type SLAStatus,
  STATUS_BAR_COLORS,
  STATUS_COLORS,
  STATUS_DOT_COLORS,
  STATUS_LABELS,
} from '@/lib/sla/status'
import { cn } from '@/lib/utils'

/** Map of icon names to Lucide components — resolved client-side. */
const ICON_MAP: Record<string, LucideIcon> = {
  Clock,
  Gauge,
  Zap,
  Inbox,
}

interface SLAMetricCardProps {
  icon: string
  label: string
  description: string
  value: number | null
  target: number
  unit: string
  status: SLAStatus
  index: number
}

export function SLAMetricCard({
  icon: iconName,
  label,
  description,
  value,
  target,
  unit,
  status,
  index,
}: SLAMetricCardProps) {
  const Icon = ICON_MAP[iconName] ?? Clock
  const shouldReduceMotion = useReducedMotion()
  const displayValue = useCountUp(value)
  const progress = value !== null ? Math.min(value / target, 1.5) : 0
  // Clamp bar to 100% visually
  const barScale = Math.min(progress, 1)

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
      initial={staggerInitial(shouldReduceMotion)}
      animate={{ opacity: 1, y: 0 }}
      transition={staggerTransitionSafe(shouldReduceMotion, index)}
    >
      {/* Label row */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.75} />
        <span className="truncate text-[13px] font-medium">{label}</span>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="ml-auto flex size-6 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
              aria-label={`About ${label}`}
            >
              <Info className="size-3" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="top"
            sideOffset={4}
            align="end"
            className="w-52 p-3"
          >
            <p className="text-xs font-semibold">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </HoverCardContent>
        </HoverCard>
      </div>

      {/* Value + target */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">
          {displayValue !== null ? `${displayValue}${unit}` : '--'}
        </span>
        <span className="font-mono text-xs text-muted-foreground/60">
          / {target}
          {unit}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', STATUS_BAR_COLORS[status])}
          initial={shouldReduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: barScale }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  type: 'spring',
                  stiffness: 80,
                  damping: 20,
                  delay: index * 0.06 + 0.2,
                }
          }
          style={{ transformOrigin: 'left' }}
        />
      </div>

      {/* Status label */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <span
          className={cn('size-1.5 rounded-full', STATUS_DOT_COLORS[status])}
        />
        <span className={cn('text-[11px] font-medium', STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
      </div>
    </motion.div>
  )
}

export interface SLAMetricCardData {
  icon: string
  label: string
  description: string
  value: number | null
  target: number
  unit: string
  status: SLAStatus
}

export function SLAMetricCards({ metrics }: { metrics: SLAMetricCardData[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, i) => (
        <SLAMetricCard key={metric.label} {...metric} index={i} />
      ))}
    </div>
  )
}
