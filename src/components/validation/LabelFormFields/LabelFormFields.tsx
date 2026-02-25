'use client'

import { useFormContext } from 'react-hook-form'

import { Separator } from '@/components/ui/Separator'
import { useExtractionStore } from '@/stores/useExtractionStore'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

import { ExtractionSkeleton } from './ExtractionSkeleton'
import { CommonFields } from './CommonFields'
import { VolumeAndClassFields } from './VolumeAndClassFields'
import { AlcoholAndContentsFields } from './AlcoholAndContentsFields'
import { ProducerInfoFields } from './ProducerInfoFields'
import { HealthWarningField } from './HealthWarningField'
import { WineSpecificFields } from './WineSpecificFields'
import { SpiritsSpecificFields } from './SpiritsSpecificFields'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LabelFormFieldsProps {
  mode: 'validate' | 'submit'
  showSplitPane: boolean
  onFieldFocus: (snakeCase: string) => void
  onFieldChange: (snakeCase: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelFormFields({
  mode,
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: LabelFormFieldsProps) {
  const { watch } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  const beverageType = watch('beverageType')

  if (extraction.status === 'extracting') {
    return <ExtractionSkeleton />
  }

  const fieldGroupProps = { showSplitPane, onFieldFocus, onFieldChange }

  return (
    <div className="flex flex-col gap-5">
      <CommonFields {...fieldGroupProps} />
      <VolumeAndClassFields />
      <AlcoholAndContentsFields {...fieldGroupProps} />

      <div className="flex flex-col gap-5 border-t border-border pt-5">
        <ProducerInfoFields {...fieldGroupProps} />

        {mode === 'validate' && (
          <>
            <Separator />
            <HealthWarningField onFieldFocus={onFieldFocus} />
          </>
        )}

        {beverageType === 'wine' && (
          <>
            <Separator />
            <WineSpecificFields {...fieldGroupProps} />
          </>
        )}

        {beverageType === 'distilled_spirits' && (
          <>
            <Separator />
            <SpiritsSpecificFields {...fieldGroupProps} />
          </>
        )}
      </div>
    </div>
  )
}
