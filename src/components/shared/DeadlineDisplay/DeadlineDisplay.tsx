import { getDeadlineInfo } from '@/lib/labels/effective-status'
import { pluralize } from '@/lib/pluralize'

const SPECIALIST_URGENCY_COLORS: Record<string, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
}

const APPLICANT_URGENCY_COLORS: Record<string, string> = {
  green: 'text-muted-foreground',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  expired: 'text-destructive',
}

interface DeadlineDisplayProps {
  deadline: Date | null
  variant?: 'specialist' | 'applicant'
}

export function DeadlineDisplay({
  deadline,
  variant = 'specialist',
}: DeadlineDisplayProps) {
  const info = getDeadlineInfo(deadline)
  if (!info) return variant === 'specialist' ? <>--</> : null

  const colors =
    variant === 'applicant'
      ? APPLICANT_URGENCY_COLORS
      : SPECIALIST_URGENCY_COLORS

  if (info.urgency === 'expired') {
    return <span className={colors.expired}>Expired</span>
  }

  const suffix =
    variant === 'applicant'
      ? 'd remaining'
      : ` ${pluralize(info.daysRemaining, 'day', { omitCount: true })}`

  return (
    <span className={colors[info.urgency]}>
      {info.daysRemaining}
      {suffix}
    </span>
  )
}
