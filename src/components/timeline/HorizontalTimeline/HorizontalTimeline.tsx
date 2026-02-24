'use client'

import {
  Check,
  Clock,
  Cpu,
  Info,
  Mail,
  RotateCw,
  Scale,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

import { STATUS_CONFIG } from '@/config/status-config'
import {
  staggerInitial,
  staggerInitialCompact,
  staggerTransitionSafe,
} from '@/lib/motion-presets'
import type { TimelineEvent } from '@/lib/timeline/types'
import { cn, formatDateTimeFull, formatTimeAgoShort } from '@/lib/utils'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'

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

/** Amber class overrides for the deadline_warning event type. */
const DEADLINE_WARNING_ICON_CLASS =
  'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
const DEADLINE_WARNING_PULSE_CLASS = 'bg-amber-400'

function getIconColor(event: TimelineEvent): string {
  if (event.type === 'deadline_warning') return DEADLINE_WARNING_ICON_CLASS
  return (
    STATUS_CONFIG[event.status ?? '']?.iconClassName ??
    'bg-muted text-muted-foreground'
  )
}

function getPulseColor(event: TimelineEvent): string {
  if (event.type === 'deadline_warning') return DEADLINE_WARNING_PULSE_CLASS
  return (
    STATUS_CONFIG[event.status ?? '']?.pulseClassName ?? 'bg-muted-foreground'
  )
}

// ---------------------------------------------------------------------------
// Shared HoverCard content
// ---------------------------------------------------------------------------

function EventHoverContent({ event }: { event: TimelineEvent }) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium">{event.title}</p>
      <p className="text-muted-foreground">{event.description}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
        <time>{formatDateTimeFull(event.timestamp)}</time>
        {event.actorName && (
          <>
            <span>·</span>
            <span>{event.actorName}</span>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG connector between desktop steps
// ---------------------------------------------------------------------------

function StepConnector() {
  return (
    <div className="mt-4 self-start">
      <svg
        width="48"
        height="2"
        viewBox="0 0 48 2"
        className="w-8 lg:w-12"
        aria-hidden
      >
        <line
          x1="0"
          y1="1"
          x2="48"
          y2="1"
          className="stroke-border/60"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop step — icon circle centered above title + timestamp
// ---------------------------------------------------------------------------

function DesktopStep({
  event,
  index,
  isLast,
}: {
  event: TimelineEvent
  index: number
  isLast: boolean
}) {
  const shouldReduceMotion = useReducedMotion()
  const Icon = ICON_MAP[event.type] ?? Check
  const isFuture = event.timestamp > new Date()

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.button
          type="button"
          className={cn(
            'group flex flex-col items-center gap-1.5 focus-visible:outline-none',
            isFuture && 'opacity-50',
          )}
          initial={staggerInitial(shouldReduceMotion)}
          animate={{ opacity: isFuture ? 0.5 : 1, y: 0 }}
          transition={staggerTransitionSafe(shouldReduceMotion, index)}
        >
          <div className="relative">
            {/* Pulse ring on last (current) event */}
            {isLast && !isFuture && !shouldReduceMotion && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full',
                  getPulseColor(event),
                )}
                animate={{
                  scale: [1, 1.8, 1.8],
                  opacity: [0, 0.35, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                  times: [0, 0.4, 1],
                }}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full border border-transparent transition-all duration-300',
                getIconColor(event),
                isFuture && 'border-border/60',
                'group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2',
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold">{event.title}</span>
            <span className="max-w-28 text-center text-[11px] leading-tight text-muted-foreground">
              {formatTimeAgoShort(event.timestamp)}
            </span>
          </div>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="center" className="w-64 text-sm">
        <EventHoverContent event={event} />
      </HoverCardContent>
    </HoverCard>
  )
}

// ---------------------------------------------------------------------------
// Mobile step — icon left, title + timestamp right, vertical list
// ---------------------------------------------------------------------------

function MobileStep({
  event,
  index,
  isLast,
}: {
  event: TimelineEvent
  index: number
  isLast: boolean
}) {
  const shouldReduceMotion = useReducedMotion()
  const Icon = ICON_MAP[event.type] ?? Check
  const isFuture = event.timestamp > new Date()

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.button
          type="button"
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            isFuture && 'opacity-50',
          )}
          initial={staggerInitialCompact(shouldReduceMotion)}
          animate={{ opacity: isFuture ? 0.5 : 1, y: 0 }}
          transition={staggerTransitionSafe(shouldReduceMotion, index, {
            duration: 0.3,
            delay: 0.05,
          })}
        >
          <div className="relative shrink-0">
            {isLast && !isFuture && !shouldReduceMotion && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full',
                  getPulseColor(event),
                )}
                animate={{
                  scale: [1, 1.8, 1.8],
                  opacity: [0, 0.35, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                  times: [0, 0.4, 1],
                }}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full transition-all duration-300',
                getIconColor(event),
                isFuture && 'ring-dashed ring-2 ring-muted-foreground/20',
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium">{event.title}</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              — {event.description}
            </span>
          </div>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" sideOffset={4} className="w-64 text-sm">
        <EventHoverContent event={event} />
      </HoverCardContent>
    </HoverCard>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface HorizontalTimelineProps {
  events: TimelineEvent[]
  guidance?: string
}

export function HorizontalTimeline({
  events,
  guidance,
}: HorizontalTimelineProps) {
  if (events.length === 0) return null

  // Display chronologically (oldest first)
  const chronological = [...events].reverse()

  return (
    <div className="@container my-6">
      {/* Desktop: horizontal stepper (container >= 768px) */}
      <div className="hidden flex-wrap items-start gap-y-4 @3xl:flex">
        {chronological.map((event, i) => {
          const isLast = i === chronological.length - 1

          return (
            <div key={event.id} className="flex items-start">
              <DesktopStep event={event} index={i} isLast={isLast} />
              {!isLast && <StepConnector />}
            </div>
          )
        })}
      </div>

      {/* Mobile/narrow: compact vertical list (container < 768px) */}
      <div className="relative @3xl:hidden">
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto pt-2 pl-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {events.map((event, i) => (
            <MobileStep
              key={event.id}
              event={event}
              index={i}
              isLast={i === 0}
            />
          ))}
        </div>
        {/* Bottom fade hint when content overflows */}
        {events.length > 4 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent"
            aria-hidden
          />
        )}
      </div>

      {guidance && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {guidance}
          </p>
        </div>
      )}
    </div>
  )
}
