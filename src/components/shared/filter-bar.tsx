'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
}

interface FilterBarProps {
  /** URL search param key (default: "status") */
  paramKey?: string
  /** Base path to navigate to (default: current path) */
  basePath?: string
  options: FilterOption[]
  className?: string
}

export function FilterBar({
  paramKey = 'status',
  basePath,
  options,
  className,
}: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldReduceMotion = useReducedMotion()
  const activeValue = searchParams.get(paramKey) ?? ''

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString())

    // Reset page on filter change
    params.delete('page')

    if (value) {
      params.set(paramKey, value)
    } else {
      params.delete(paramKey)
    }

    const qs = params.toString()
    const path = basePath ?? window.location.pathname
    router.push(qs ? `${path}?${qs}` : path)
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
              'ease relative cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150',
              isActive
                ? 'text-primary-foreground'
                : 'border border-border text-foreground hover:bg-accent hover:text-accent-foreground',
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
