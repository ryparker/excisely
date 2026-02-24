import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Shared stat card content — used by both StatCard (static) and interactive
// wrappers (e.g. motion.button in submissions).
// ---------------------------------------------------------------------------

export interface StatCardContentProps {
  icon: LucideIcon
  /** Tailwind bg class for icon container, e.g. 'bg-blue-100 dark:bg-blue-900/30' */
  iconBg: string
  /** Tailwind text class for the icon, e.g. 'text-blue-600 dark:text-blue-400' */
  iconColor: string
  label: string
  value: React.ReactNode
  description: string
  valueClassName?: string
}

export function StatCardContent({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  description,
  valueClassName,
}: StatCardContentProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
            iconBg,
          )}
        >
          <Icon className={cn('size-[18px]', iconColor)} />
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-4">
        <div
          className={cn(
            'font-heading text-2xl font-bold tracking-tight tabular-nums',
            valueClassName,
          )}
        >
          {value}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Convenience wrapper for static (non-interactive) stat cards.
// ---------------------------------------------------------------------------

export const STAT_CARD_BASE =
  'flex flex-col rounded-xl border bg-card p-4 shadow-sm' as const

interface StatCardProps
  extends
    StatCardContentProps,
    Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {}

export function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  description,
  valueClassName,
  className,
  ...divProps
}: StatCardProps) {
  return (
    <div className={cn(STAT_CARD_BASE, className)} {...divProps}>
      <StatCardContent
        icon={icon}
        iconBg={iconBg}
        iconColor={iconColor}
        label={label}
        value={value}
        description={description}
        valueClassName={valueClassName}
      />
    </div>
  )
}
