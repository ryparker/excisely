'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Activity, Info } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import type { TokenUsageMetrics } from '@/lib/sla/queries'
import { formatNumber } from '@/lib/utils'

export function TokenUsageSummary({
  metrics,
  index = 4,
}: {
  metrics: TokenUsageMetrics
  index?: number
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              type: 'tween',
              duration: 0.35,
              delay: index * 0.06,
              ease: [0.25, 0.46, 0.45, 0.94],
            }
      }
    >
      {/* Label row */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Activity className="size-3.5" strokeWidth={1.75} />
        <span className="text-[13px] font-medium">Token Usage</span>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="ml-auto flex size-6 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
              aria-label="About Token Usage"
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
            <p className="text-xs font-semibold">Token Usage</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Total AI tokens consumed by the classification pipeline over the
              last 30 days. Includes GPT-5 Mini input and output tokens.
            </p>
          </HoverCardContent>
        </HoverCard>
      </div>

      {/* Total tokens */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">
          {formatNumber(metrics.totalTokens)}
        </span>
        <span className="font-mono text-xs text-muted-foreground/60">
          tokens
        </span>
      </div>

      {/* Breakdown */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          <span className="font-mono tabular-nums">
            {formatNumber(metrics.totalInputTokens)}
          </span>{' '}
          in
        </span>
        <span className="text-muted-foreground/30">/</span>
        <span>
          <span className="font-mono tabular-nums">
            {formatNumber(metrics.totalOutputTokens)}
          </span>{' '}
          out
        </span>
      </div>

      {/* Footer stats */}
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground/60">
        <span>
          {metrics.validationCount} validation
          {metrics.validationCount !== 1 ? 's' : ''}
        </span>
        {metrics.avgTokensPerValidation !== null && (
          <>
            <span className="text-muted-foreground/20">|</span>
            <span>
              ~{formatNumber(metrics.avgTokensPerValidation)} avg/validation
            </span>
          </>
        )}
      </div>
    </motion.div>
  )
}
