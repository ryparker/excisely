'use client'

import { motion, useReducedMotion } from 'motion/react'
import {
  Camera,
  Check,
  CheckCircle2,
  Lightbulb,
  PenLine,
  Send,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  useExtractionStore,
  type SubmissionStep,
} from '@/stores/extraction-store'

interface Step {
  icon: LucideIcon
  title: string
  description: string
  hoverTitle: string
  hoverDetail: string
  hoverTip: string
  /** Solid color for completed/active bg */
  solidBg: string
  /** Solid color for completed/active text */
  solidText: string
  /** Muted color for upcoming bg */
  mutedBg: string
  /** Muted color for upcoming icon */
  mutedIcon: string
  /** Ring color for active pulse */
  ringColor: string
  /** Connector fill color (when completed) */
  connectorColor: string
}

const STEPS: Step[] = [
  {
    icon: Camera,
    title: 'Upload Photos',
    description: 'Take a photo of your label',
    hoverTitle: 'Upload label images',
    hoverDetail:
      'Front, back, and neck labels — clear and well-lit for best results.',
    hoverTip: 'A steady hand and good lighting go a long way.',
    solidBg: 'bg-blue-600 dark:bg-blue-500',
    solidText: 'text-white',
    mutedBg: 'bg-blue-50 dark:bg-blue-950/40',
    mutedIcon: 'text-blue-600/40 dark:text-blue-400/40',
    ringColor: 'shadow-blue-400/40 dark:shadow-blue-500/30',
    connectorColor: 'stroke-blue-500 dark:stroke-blue-400',
  },
  {
    icon: Sparkles,
    title: 'We Read It',
    description: 'We fill out the form for you',
    hoverTitle: 'Automatic field extraction',
    hoverDetail:
      'Our system reads your label and fills in the fields — usually takes a few seconds.',
    hoverTip: 'The clearer the photo, the more accurate the results.',
    solidBg: 'bg-amber-500 dark:bg-amber-500',
    solidText: 'text-white',
    mutedBg: 'bg-amber-50 dark:bg-amber-950/40',
    mutedIcon: 'text-amber-600/40 dark:text-amber-400/40',
    ringColor: 'shadow-amber-400/40 dark:shadow-amber-500/30',
    connectorColor: 'stroke-amber-500 dark:stroke-amber-400',
  },
  {
    icon: PenLine,
    title: 'You Review',
    description: 'Make any changes before submitting',
    hoverTitle: 'Review & edit',
    hoverDetail:
      'Check the pre-filled fields, fix anything that looks off, add anything we missed.',
    hoverTip: 'Double-check the alcohol content and health warning.',
    solidBg: 'bg-violet-600 dark:bg-violet-500',
    solidText: 'text-white',
    mutedBg: 'bg-violet-50 dark:bg-violet-950/40',
    mutedIcon: 'text-violet-600/40 dark:text-violet-400/40',
    ringColor: 'shadow-violet-400/40 dark:shadow-violet-500/30',
    connectorColor: 'stroke-violet-500 dark:stroke-violet-400',
  },
  {
    icon: Send,
    title: 'Submit',
    description: 'Send it to us for review',
    hoverTitle: 'Submit for review',
    hoverDetail:
      'Your application goes to a labeling specialist for final review.',
    hoverTip: 'Track your submission anytime from "My Submissions."',
    solidBg: 'bg-emerald-600 dark:bg-emerald-500',
    solidText: 'text-white',
    mutedBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    mutedIcon: 'text-emerald-600/40 dark:text-emerald-400/40',
    ringColor: 'shadow-emerald-400/40 dark:shadow-emerald-500/30',
    connectorColor: 'stroke-emerald-500 dark:stroke-emerald-400',
  },
  {
    icon: CheckCircle2,
    title: 'Get Your Decision',
    description: 'Hear back within 3 business days',
    hoverTitle: 'Receive your decision',
    hoverDetail:
      "Your application will be Approved, or we'll let you know exactly what needs to change.",
    hoverTip: 'Most corrections can be resolved in a single round.',
    solidBg: 'bg-gold dark:bg-gold',
    solidText: 'text-white dark:text-background',
    mutedBg: 'bg-gold/10 dark:bg-gold/15',
    mutedIcon: 'text-gold/40',
    ringColor: 'shadow-gold/40',
    connectorColor: 'stroke-gold',
  },
]

type StepState = 'completed' | 'active' | 'upcoming'

function getStepState(
  stepIndex: number,
  currentStep: SubmissionStep,
): StepState {
  const stepNumber = (stepIndex + 1) as SubmissionStep
  if (stepNumber < currentStep) return 'completed'
  if (stepNumber === currentStep) return 'active'
  return 'upcoming'
}

function ProcessStep({
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
          <div className="relative">
            {/* Step circle */}
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

              {/* Active pulse ring */}
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

            {/* Step number badge */}
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

function StepConnector({ index, filled }: { index: number; filled: boolean }) {
  const shouldReduceMotion = useReducedMotion()
  const step = STEPS[index]

  return (
    <div className="relative mt-4 self-start">
      <svg
        width="48"
        height="2"
        viewBox="0 0 48 2"
        className="w-8 lg:w-12"
        aria-hidden
      >
        {/* Background track */}
        <line
          x1="0"
          y1="1"
          x2="48"
          y2="1"
          className="stroke-border/60"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Animated fill */}
        {filled && (
          <motion.line
            x1="0"
            y1="1"
            x2="48"
            y2="1"
            className={step.connectorColor}
            strokeWidth="2"
            strokeLinecap="round"
            initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.5,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }
            }
          />
        )}
      </svg>
    </div>
  )
}

function MobileStep({
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
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            state === 'active' && 'bg-muted/30',
          )}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  type: 'tween',
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }
          }
        >
          <div className="relative shrink-0">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border transition-all duration-300',
                state === 'completed' && [step.solidBg, 'border-transparent'],
                state === 'active' && [step.solidBg, 'border-transparent'],
                state === 'upcoming' && [step.mutedBg, 'border-border/60'],
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
          <div className="min-w-0">
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
                'ml-1.5 text-[11px] transition-colors duration-300',
                state === 'upcoming'
                  ? 'text-muted-foreground/40'
                  : 'text-muted-foreground',
              )}
            >
              — {step.description}
            </span>
          </div>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" sideOffset={4} className="w-56 p-3">
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

export function HowItWorks() {
  const submissionStep = useExtractionStore((s) => s.submissionStep)

  return (
    <div className="my-6">
      {/* Desktop: horizontal stepper */}
      <div className="hidden items-start sm:flex">
        {STEPS.map((step, i) => {
          const state = getStepState(i, submissionStep)
          const connectorFilled = i < submissionStep - 1
          return (
            <div key={step.title} className="flex items-start">
              <ProcessStep step={step} index={i} state={state} />
              {i < STEPS.length - 1 && (
                <StepConnector index={i} filled={connectorFilled} />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: compact vertical list */}
      <div className="flex flex-col gap-0.5 sm:hidden">
        {STEPS.map((step, i) => {
          const state = getStepState(i, submissionStep)
          return (
            <MobileStep key={step.title} step={step} index={i} state={state} />
          )
        })}
      </div>
    </div>
  )
}
