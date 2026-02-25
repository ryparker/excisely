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

export function SpiritsSpecificFields({
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-4 font-heading text-sm font-semibold tracking-tight">
        Spirits-Specific Fields
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ageStatement" className="flex items-center gap-1.5">
            <FieldLabel fieldName="age_statement">Age Statement</FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="age_statement"
            />
          </Label>
          <Input
            id="ageStatement"
            placeholder="e.g., Aged 12 Years"
            className={cn(
              extraction.aiOriginalValues.has('age_statement') &&
                !extraction.modifiedFields.has('age_statement') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('ageStatement', {
              onChange: () => onFieldChange('age_statement'),
            })}
            onFocus={() => onFieldFocus('age_statement')}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="stateOfDistillation"
            className="flex items-center gap-1.5"
          >
            <FieldLabel fieldName="state_of_distillation">
              State of Distillation
            </FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="state_of_distillation"
            />
          </Label>
          <Input
            id="stateOfDistillation"
            placeholder="e.g., Kentucky"
            className={cn(
              extraction.aiOriginalValues.has('state_of_distillation') &&
                !extraction.modifiedFields.has('state_of_distillation') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('stateOfDistillation', {
              onChange: () => onFieldChange('state_of_distillation'),
            })}
            onFocus={() => onFieldFocus('state_of_distillation')}
          />
        </div>
      </div>
    </fieldset>
  )
}
