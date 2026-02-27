'use client'

import { useFormContext } from 'react-hook-form'

import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import type { FieldGroupProps } from './FieldGroupTypes'

const ALCOHOL_PLACEHOLDERS: Record<string, string> = {
  wine: 'e.g., Alc. 14.5% By Vol.',
  distilled_spirits: 'e.g., 45% Alc./Vol.',
  malt_beverage: 'e.g., Alc. 5.2% By Vol.',
}

export function AlcoholAndContentsFields({
  beverageType,
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Alcohol and Contents</legend>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="alcoholContent" className="flex items-center gap-1.5">
            <FieldLabel fieldName="alcohol_content">Alcohol Content</FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="alcohol_content"
            />
          </Label>
          <Input
            id="alcoholContent"
            placeholder={
              beverageType
                ? ALCOHOL_PLACEHOLDERS[beverageType]
                : 'e.g., 45% Alc./Vol.'
            }
            className={cn(
              extraction.aiOriginalValues.has('alcohol_content') &&
                !extraction.modifiedFields.has('alcohol_content') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('alcoholContent', {
              onChange: () => onFieldChange('alcohol_content'),
            })}
            onFocus={() => onFieldFocus('alcohol_content')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="netContents" className="flex items-center gap-1.5">
            <FieldLabel fieldName="net_contents">Net Contents</FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="net_contents"
            />
          </Label>
          <Input
            id="netContents"
            placeholder="e.g., 750 mL"
            className={cn(
              extraction.aiOriginalValues.has('net_contents') &&
                !extraction.modifiedFields.has('net_contents') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('netContents', {
              onChange: () => onFieldChange('net_contents'),
            })}
            onFocus={() => onFieldFocus('net_contents')}
          />
        </div>
      </div>
    </fieldset>
  )
}
