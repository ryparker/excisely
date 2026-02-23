'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useQueryState, parseAsString } from 'nuqs'

import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
  count?: number
  /** Highlight this filter as needing attention (e.g. items awaiting action) */
  attention?: boolean
}

interface FilterBarProps {
  /** URL search param key (default: "status") */
  paramKey?: string
  options: FilterOption[]
  className?: string
}

export function FilterBar({
  paramKey = 'status',
  options,
  className,
}: FilterBarProps) {
  const shouldReduceMotion = useReducedMotion()
  const [, setPage] = useQueryState('page', parseAsString)
  const [activeValue, setActiveValue] = useQueryState(
    paramKey,
    parseAsString.withDefault('').withOptions({ shallow: false }),
  )

  function handleSelect(value: string) {
    void setPage(null) // Reset pagination on filter change
    void setActiveValue(value || null)
  }

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      role="radiogroup"
      aria-label="Filter options"
    >
      {options.map((option) => {
        const isActive = activeValue === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => handleSelect(option.value)}
            className={cn(
              'ease relative cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {/* Animated pill background */}
            {isActive && (
              <motion.span
                layoutId={`filter-pill-${paramKey}`}
                className="absolute inset-0 rounded-full bg-primary"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        type: 'spring',
                        duration: 0.4,
                        bounce: 0.15,
                      }
                }
              />
            )}
            <span className="relative z-10">
              {option.label}
              {option.count !== undefined && option.count > 0 && (
                <span
                  className={cn(
                    'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] leading-tight font-semibold tabular-nums',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : option.attention
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {option.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
