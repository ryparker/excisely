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
