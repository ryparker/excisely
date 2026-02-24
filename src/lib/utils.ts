import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { pluralize } from '@/lib/pluralize'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shared breakdown for relative-time formatting. */
type TimeBreakdown =
  | { unit: 'just_now' }
  | { unit: 'minutes'; value: number; isFuture: boolean }
  | { unit: 'hours'; value: number; isFuture: boolean }
  | { unit: 'days'; value: number; isFuture: boolean }
  | { unit: 'older'; date: Date }

function getRelativeTimeBreakdown(date: Date): TimeBreakdown {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const absDiffMs = Math.abs(diffMs)
  const isFuture = diffMs < 0

  if (absDiffMs < 60_000) return { unit: 'just_now' }

  const minutes = Math.floor(absDiffMs / 60_000)
  if (minutes < 60) return { unit: 'minutes', value: minutes, isFuture }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { unit: 'hours', value: hours, isFuture }

  const days = Math.floor(hours / 24)
  if (days < 30) return { unit: 'days', value: days, isFuture }

  return { unit: 'older', date }
}

/**
 * Human-readable relative time, e.g. "3 days ago", "in 2 hours".
 * Uses longer labels (not abbreviations) for user-facing text.
 */
export function timeAgo(date: Date): string {
  const b = getRelativeTimeBreakdown(date)
  if (b.unit === 'just_now') return 'just now'
  if (b.unit === 'older')
    return b.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const unitMap = { minutes: 'minute', hours: 'hour', days: 'day' } as const
  const label = pluralize(b.value, unitMap[b.unit])
  return b.isFuture ? `in ${label}` : `${label} ago`
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
  const b = getRelativeTimeBreakdown(date)
  if (b.unit === 'just_now') return 'just now'
  if (b.unit === 'older')
    return b.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })

  const suffixMap = { minutes: 'm', hours: 'h', days: 'd' } as const
  const label = `${b.value}${suffixMap[b.unit]}`
  return b.isFuture ? `in ${label}` : `${label} ago`
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
