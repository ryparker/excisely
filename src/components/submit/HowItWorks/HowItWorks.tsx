'use client'

import { useExtractionStore } from '@/stores/useExtractionStore'

import { STEPS, getStepState } from './HowItWorksTypes'
import { ProcessStep } from './ProcessStep'
import { StepConnector } from './StepConnector'
import { MobileStep } from './MobileStep'

interface HowItWorksProps {
  scanAvailable?: boolean
}

export function HowItWorks({ scanAvailable = false }: HowItWorksProps) {
  const submissionStep = useExtractionStore((s) => s.submissionStep)

  // Local mode has no AI extraction steps to visualize — the form itself guides the user
  if (!scanAvailable) return null

  return (
    <div className="my-10">
      {/* Desktop: horizontal stepper */}
      <div className="hidden items-start sm:flex">
        {STEPS.map((step, i) => {
          const state = getStepState(i, submissionStep)
          const connectorFilled = i < submissionStep - 1
          return (
            <div key={step.title} className="flex items-start">
              <ProcessStep step={step} index={i} state={state} />
              {i < STEPS.length - 1 && (
                <StepConnector step={step} filled={connectorFilled} />
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
