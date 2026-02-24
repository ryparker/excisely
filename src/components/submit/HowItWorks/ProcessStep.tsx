'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Check, Lightbulb } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import { Separator } from '@/components/ui/Separator'
import { staggerInitial, staggerTransitionSafe } from '@/lib/motion-presets'
import { cn } from '@/lib/utils'

import type { Step, StepState } from './HowItWorksTypes'

export function ProcessStep({
  step,
  index,
  state,
}: {
  step: Step
  index: number
  state: StepState
}) {
  const shouldReduceMotion = useReducedMotion()
  const Icon = step.icon

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.button
          type="button"
          className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
          initial={staggerInitial(shouldReduceMotion)}
          animate={{ opacity: 1, y: 0 }}
          transition={staggerTransitionSafe(shouldReduceMotion, index)}
        >
          <div className="relative">
            <div
              className={cn(
                'relative flex size-8 items-center justify-center rounded-full border transition-all duration-300',
                state === 'completed' && [step.solidBg, 'border-transparent'],
                state === 'active' && [
                  step.solidBg,
                  'border-transparent',
                  !shouldReduceMotion && 'shadow-[0_0_0_3px] ' + step.ringColor,
                ],
                state === 'upcoming' && [step.mutedBg, 'border-border/60'],
                'group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2',
              )}
            >
              {state === 'completed' ? (
                <Check
                  className={cn('size-3.5', step.solidText)}
                  strokeWidth={2.5}
                />
              ) : (
                <Icon
                  className={cn(
                    'size-3.5 transition-colors duration-300',
                    state === 'active' ? step.solidText : step.mutedIcon,
                  )}
                  strokeWidth={1.75}
                />
              )}

              {state === 'active' && !shouldReduceMotion && (
                <motion.div
                  className={cn('absolute inset-0 rounded-full', step.solidBg)}
                  animate={{
                    opacity: [0, 0.35, 0],
                    scale: [1, 1.8, 1.8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                    times: [0, 0.4, 1],
                  }}
                />
              )}
            </div>

            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full font-mono text-[8px] font-semibold transition-all duration-300',
                state === 'completed' && [
                  step.solidBg,
                  step.solidText,
                  'border-transparent',
                ],
                state === 'active' && [
                  step.solidBg,
                  step.solidText,
                  'border-transparent',
                ],
                state === 'upcoming' && [
                  'border border-border/60 bg-background text-muted-foreground',
                  'group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground',
                ],
              )}
            >
              {state === 'completed' ? (
                <Check className="size-2" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={cn(
                'text-xs font-semibold transition-colors duration-300',
                state === 'upcoming'
                  ? 'text-muted-foreground/60'
                  : 'text-foreground',
              )}
            >
              {step.title}
            </span>
            <span
              className={cn(
                'max-w-28 text-center text-[11px] leading-tight transition-colors duration-300',
                state === 'upcoming'
                  ? 'text-muted-foreground/40'
                  : 'text-muted-foreground',
              )}
            >
              {step.description}
            </span>
          </div>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" sideOffset={8} className="w-56 p-3">
        <p className="text-[13px] leading-tight font-semibold">
          {step.hoverTitle}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {step.hoverDetail}
        </p>
        <Separator className="my-2" />
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
          <Lightbulb className="mt-0.5 size-3 shrink-0 text-gold" />
          {step.hoverTip}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
