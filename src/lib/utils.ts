import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Human-readable relative time, e.g. "3 days ago", "in 2 hours".
 * Uses longer labels (not abbreviations) for user-facing text.
 */
export function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const absDiffMs = Math.abs(diffMs)
  const isFuture = diffMs < 0

  if (absDiffMs < 60_000) return 'just now'

  const minutes = Math.floor(absDiffMs / 60_000)
  if (minutes < 60) {
    const label = minutes === 1 ? 'minute' : 'minutes'
    return isFuture ? `in ${minutes} ${label}` : `${minutes} ${label} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const label = hours === 1 ? 'hour' : 'hours'
    return isFuture ? `in ${hours} ${label}` : `${hours} ${label} ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    const label = days === 1 ? 'day' : 'days'
    return isFuture ? `in ${days} ${label}` : `${days} ${label} ago`
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Returns a Tailwind text color class based on a confidence score (0-100).
 * Green (>=90), amber (>=70), red (<70). Returns muted for null/undefined.
 */
export function confidenceColor(value: number | string | null): string {
  if (value === null || value === undefined) return 'text-muted-foreground/40'
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return 'text-muted-foreground/40'
  if (num >= 90) return 'text-emerald-600 dark:text-emerald-400'
  if (num >= 70) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

/** Format a date as "Jan 1, 2026". */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/** Format a date as "January 1, 2026". */
export function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/** Format a confidence score as "XX%" or "--" when null. */
export function formatConfidence(value: string | number | null): string {
  if (value === null || value === undefined) return '--'
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return '--'
  return `${Math.round(num)}%`
}

/** Format processing time in milliseconds as "X.Xs" or "--" when null. */
export function formatProcessingTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '--'
  return `${(ms / 1000).toFixed(1)}s`
}

/** Format a number with compact k/M suffixes. */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

/** Convert a snake_case enum key to a human-readable string, e.g. "needs_correction" → "needs correction". */
export function humanizeEnum(key: string): string {
  return key.replace(/_/g, ' ')
}

/** Format a review date: "Jan 1" (same year) or "Jan 1, 2025" (different year). */
export function formatReviewDate(date: Date): string {
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

/**
 * Compact relative time: "3m ago", "2h ago", "5d ago", or "Jan 1" for older dates.
 * Handles future dates with "in" prefix.
 */
export function formatTimeAgoShort(date: Date): string {
  const now = new Date()
  const diffMs = Math.abs(date.getTime() - now.getTime())
  const isFuture = date.getTime() > now.getTime()

  if (diffMs < 60_000) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return isFuture ? `in ${minutes}m` : `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return isFuture ? `in ${days}d` : `${days}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Full datetime: "Jan 1, 2026, 3:45 PM". */
export function formatDateTimeFull(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
