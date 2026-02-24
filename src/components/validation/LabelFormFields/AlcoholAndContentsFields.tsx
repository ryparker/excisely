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

export function AlcoholAndContentsFields({
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Alcohol and Contents</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
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
            placeholder="e.g., 45% Alc./Vol."
            className={cn(
              extraction.aiOriginalValues.has('alcohol_content') &&
                !extraction.modifiedFields.has('alcohol_content') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('alcoholContent')}
            onFocus={() => onFieldFocus('alcohol_content')}
            onChange={(e) => {
              register('alcoholContent').onChange(e)
              onFieldChange('alcohol_content')
            }}
          />
        </div>

        <div className="space-y-2">
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
            {...register('netContents')}
            onFocus={() => onFieldFocus('net_contents')}
            onChange={(e) => {
              register('netContents').onChange(e)
              onFieldChange('net_contents')
            }}
          />
        </div>
      </div>
    </fieldset>
  )
}
