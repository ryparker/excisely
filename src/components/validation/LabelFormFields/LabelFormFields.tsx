'use client'

import type { BeverageType } from '@/config/beverage-types'
import { Separator } from '@/components/ui/Separator'
import { useExtractionStore } from '@/stores/useExtractionStore'

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
  beverageType: BeverageType | undefined
  showSplitPane: boolean
  onFieldFocus: (snakeCase: string) => void
  onFieldChange: (snakeCase: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelFormFields({
  mode,
  beverageType,
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: LabelFormFieldsProps) {
  const extraction = useExtractionStore()

  if (extraction.status === 'extracting') {
    return <ExtractionSkeleton />
  }

  const fieldGroupProps = {
    beverageType,
    showSplitPane,
    onFieldFocus,
    onFieldChange,
  }

  return (
    <div className="flex flex-col gap-5">
      <CommonFields {...fieldGroupProps} />
      <VolumeAndClassFields beverageType={beverageType} />
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
