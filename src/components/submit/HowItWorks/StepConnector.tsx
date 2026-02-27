'use client'

import { motion, useReducedMotion } from 'motion/react'

import type { Step } from './HowItWorksTypes'

export function StepConnector({
  step,
  filled,
}: {
  step: Step
  filled: boolean
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative mt-4 self-start">
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
