'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useQueryState, parseAsString } from 'nuqs'

import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
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
                layoutId="filter-pill"
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
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
