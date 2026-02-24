'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Mail,
  RotateCw,
  Scale,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import type { TimelineEvent } from '@/lib/timeline/types'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, typeof Mail> = {
  submitted: Check,
  processing_complete: Cpu,
  reanalysis_triggered: RotateCw,
  status_determined: Scale,
  email_sent: Mail,
  specialist_review: UserCheck,
  status_override: ShieldAlert,
  override_email_sent: Mail,
  deadline_warning: Clock,
}

function getIconColor(event: TimelineEvent): string {
  if (event.type === 'deadline_warning') {
    return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
  }
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

function formatShortTime(date: Date): string {
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

// Scroll by ~3 steps worth of pixels
const SCROLL_AMOUNT = 360

interface HorizontalTimelineProps {
  events: TimelineEvent[]
  guidance?: string
}

export function HorizontalTimeline({
  events,
  guidance,
}: HorizontalTimelineProps) {
  const shouldReduceMotion = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  // Auto-scroll to the most recent (rightmost) event on mount
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // Instant scroll to end — no animation on mount
    el.scrollLeft = el.scrollWidth
    // Defer state update so layout is settled
    requestAnimationFrame(updateScrollState)

    const observer = new ResizeObserver(updateScrollState)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateScrollState])

  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current
      if (!el) return
      el.scrollBy({
        left: direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
        behavior: shouldReduceMotion ? 'instant' : 'smooth',
      })
    },
    [shouldReduceMotion],
  )

  if (events.length === 0) return null

  // Display chronologically (oldest first) for horizontal flow
  const chronological = [...events].reverse()

  return (
    <div className="relative isolate">
      {/* Left arrow — 44px tap target, visually compact */}
      <button
        onClick={() => scroll('left')}
        className={cn(
          'absolute top-1/2 -left-1 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm',
          'transition-opacity duration-150',
          'before:absolute before:inset-[-8px] before:content-[""]',
          'hover:text-foreground',
          canScrollLeft
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        aria-label="Scroll timeline left"
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        className={cn(
          'absolute top-1/2 -right-1 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/50 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm',
          'transition-opacity duration-150',
          'before:absolute before:inset-[-8px] before:content-[""]',
          'hover:text-foreground',
          canScrollRight
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        aria-label="Scroll timeline right"
        tabIndex={canScrollRight ? 0 : -1}
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Scroll container — hidden scrollbar, native touch/trackpad support */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex items-start gap-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chronological.map((event, index) => {
          const Icon = ICON_MAP[event.type] ?? Check
          const isFuture = event.timestamp > new Date()
          const isLast = index === chronological.length - 1

          return (
            <div key={event.id} className="flex items-start">
              {/* Step */}
              <motion.div
                className={cn(
                  'flex shrink-0 flex-col items-center',
                  isFuture && 'opacity-50',
                )}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: isFuture ? 0.5 : 1, y: 0 }}
                transition={{
                  delay: shouldReduceMotion ? 0 : index * 0.06,
                  duration: 0.25,
                }}
              >
                <motion.div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    getIconColor(event),
                    isFuture && 'ring-dashed ring-2 ring-muted-foreground/20',
                  )}
                  initial={shouldReduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 25,
                    delay: shouldReduceMotion ? 0 : index * 0.06,
                  }}
                >
                  <Icon className="size-3.5" />
                </motion.div>
                <p className="mt-1.5 max-w-[120px] text-center text-xs leading-tight font-medium">
                  {event.title}
                </p>
                <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
                  {formatShortTime(event.timestamp)}
                </p>
              </motion.div>

              {/* Connector line */}
              {!isLast && (
                <div className="mt-3 flex items-center px-1">
                  <div
                    className={cn(
                      'h-px w-8 sm:w-12',
                      isFuture
                        ? 'border-t border-dashed border-muted-foreground/25'
                        : 'bg-border',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {guidance && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {guidance}
        </p>
      )}
    </div>
  )
}
