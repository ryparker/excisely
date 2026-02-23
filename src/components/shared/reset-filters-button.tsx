'use client'

import { useTransition } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useQueryStates, parseAsString } from 'nuqs'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResetFiltersButtonProps {
  /** URL param keys to clear (e.g. ["status", "beverageType"]) */
  paramKeys: string[]
  className?: string
}

export function ResetFiltersButton({
  paramKeys,
  className,
}: ResetFiltersButtonProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const parsers = Object.fromEntries(
    ['page', ...paramKeys].map((key) => [key, parseAsString]),
  )
  const [params, setParams] = useQueryStates(parsers, {
    shallow: false,
    startTransition,
  })

  const activeCount = paramKeys.filter(
    (key) => params[key] != null && params[key] !== '',
  ).length

  function handleReset() {
    const reset = Object.fromEntries(
      ['page', ...paramKeys].map((key) => [key, null]),
    )
    void setParams(reset)
  }

  return (
    <AnimatePresence initial={false}>
      {activeCount > 0 && (
        <motion.div
          initial={
            shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }
          }
          animate={
            shouldReduceMotion ? { opacity: 1 } : { opacity: 1, width: 'auto' }
          }
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
          className="shrink-0 overflow-hidden"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className={cn(
              'h-9 gap-1.5 text-xs whitespace-nowrap text-muted-foreground',
              isPending && 'opacity-70',
              className,
            )}
          >
            <X className="size-3" />
            Reset filters
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
              {activeCount}
            </span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
