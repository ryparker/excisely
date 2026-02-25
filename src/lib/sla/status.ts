export type SLAStatus = 'green' | 'amber' | 'red'

/**
 * Determine RAG status for an SLA metric.
 * `lowerIsBetter` = true for time-based metrics, false for rate-based.
 */
export function getSLAStatus(
  actual: number,
  target: number,
  lowerIsBetter = true,
): SLAStatus {
  if (lowerIsBetter) {
    if (actual <= target * 0.8) return 'green'
    if (actual <= target) return 'amber'
    return 'red'
  }
  // Higher is better (e.g., auto-approval rate)
  if (actual >= target) return 'green'
  if (actual >= target * 0.8) return 'amber'
  return 'red'
}

export const STATUS_COLORS: Record<SLAStatus, string> = {
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
}

export const STATUS_BG: Record<SLAStatus, string> = {
  green: 'bg-green-100 dark:bg-green-900/30',
  amber: 'bg-amber-100 dark:bg-amber-900/30',
  red: 'bg-red-100 dark:bg-red-900/30',
}

export const STATUS_BAR_COLORS: Record<SLAStatus, string> = {
  green: 'bg-green-500 dark:bg-green-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  red: 'bg-red-500 dark:bg-red-400',
}

export const STATUS_DOT_COLORS: Record<SLAStatus, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

export const STATUS_LABELS: Record<SLAStatus, string> = {
  green: 'On target',
  amber: 'Approaching limit',
  red: 'Over limit',
}

/** Return the worst status across multiple SLA statuses. */
export function worstSLAStatus(statuses: SLAStatus[]): SLAStatus {
  if (statuses.includes('red')) return 'red'
  if (statuses.includes('amber')) return 'amber'
  return 'green'
}
