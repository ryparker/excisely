'use client'

import { useState } from 'react'
import {
  Check,
  Clock,
  Cpu,
  Mail,
  Scale,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import type { TimelineEvent } from '@/lib/timeline/types'
import { getDeadlineInfo } from '@/lib/labels/effective-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TimelineEmailPreview } from './timeline-email-preview'

// ---------------------------------------------------------------------------
// Icon + color mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, typeof Mail> = {
  submitted: Check,
  processing_complete: Cpu,
  status_determined: Scale,
  email_sent: Mail,
  specialist_review: UserCheck,
  status_override: ShieldAlert,
  override_email_sent: Mail,
  deadline_warning: Clock,
}

function getIconColor(event: TimelineEvent): string {
  // Deadline warnings get special treatment
  if (event.type === 'deadline_warning') {
    const info = getDeadlineInfo(event.timestamp)
    if (!info) return 'bg-muted text-muted-foreground'
    const colors: Record<string, string> = {
      red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      amber:
        'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
      green:
        'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
      expired: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
    }
    return colors[info.urgency] ?? 'bg-muted text-muted-foreground'
  }

  // Status-based coloring
  switch (event.status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'conditionally_approved':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
    case 'needs_correction':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'
    case 'rejected':
      return 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    case 'pending_review':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
    case 'processing':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const absDiffMs = Math.abs(diffMs)
  const isFuture = diffMs > 0

  if (absDiffMs < 60_000) return isFuture ? 'in less than a minute' : 'just now'

  const minutes = Math.floor(absDiffMs / 60_000)
  if (minutes < 60) {
    return isFuture ? `in ${minutes}m` : `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return isFuture ? `in ${hours}h` : `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return isFuture ? `in ${days}d` : `${days}d ago`
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TimelineEventItemProps {
  event: TimelineEvent
  index: number
  isLast: boolean
}

export function TimelineEventItem({
  event,
  index,
  isLast,
}: TimelineEventItemProps) {
  const [expanded, setExpanded] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const hasEmail = !!event.email
  const isFuture = event.timestamp > new Date()
  const Icon = ICON_MAP[event.type] ?? Check

  const deadlineInfo =
    event.type === 'deadline_warning' ? getDeadlineInfo(event.timestamp) : null

  return (
    <motion.div
      className="relative flex gap-4"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: shouldReduceMotion ? 0 : index * 0.04,
        duration: 0.3,
      }}
    >
      {/* Left column: icon + connector line */}
      <div className="flex flex-col items-center">
        <motion.div
          className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${getIconColor(event)} ${isFuture ? 'ring-dashed ring-2 ring-muted-foreground/20' : ''}`}
          initial={shouldReduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 25,
            delay: shouldReduceMotion ? 0 : index * 0.04,
          }}
        >
          <Icon className="size-4" />
        </motion.div>
        {!isLast && (
          <div
            className={`min-h-6 w-px flex-1 ${isFuture ? 'border-l-2 border-dashed border-muted-foreground/20' : 'bg-border'}`}
          />
        )}
      </div>

      {/* Right column: content */}
      <div className={`flex-1 pb-6 ${isFuture ? 'opacity-60' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm leading-tight font-medium">{event.title}</h3>
          {event.actorName && (
            <span className="text-xs text-muted-foreground">
              by {event.actorName}
            </span>
          )}
          {deadlineInfo && deadlineInfo.daysRemaining > 0 && (
            <Badge
              variant="outline"
              className={
                deadlineInfo.urgency === 'red'
                  ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
                  : deadlineInfo.urgency === 'amber'
                    ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                    : 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400'
              }
            >
              {deadlineInfo.daysRemaining}d remaining
            </Badge>
          )}
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRelativeTime(event.timestamp)}
          {' \u00B7 '}
          {event.timestamp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>

        <p className="mt-1.5 text-sm text-muted-foreground">
          {event.description}
        </p>

        {/* Notes from reviews/overrides */}
        {event.metadata?.notes && (
          <p className="mt-1.5 rounded bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground italic">
            &ldquo;{event.metadata.notes}&rdquo;
          </p>
        )}

        {/* View Email button */}
        {hasEmail && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              <Mail className="size-3" />
              {expanded ? 'Hide Email' : 'View Email'}
            </Button>

            <AnimatePresence initial={false}>
              {expanded && event.email && (
                <motion.div
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, height: 0 }
                  }
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, height: 0 }
                  }
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2">
                    <TimelineEmailPreview email={event.email} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
