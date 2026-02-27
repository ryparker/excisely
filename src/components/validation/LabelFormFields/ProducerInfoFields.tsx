'use client'

import { useFormContext } from 'react-hook-form'

import { Combobox } from '@/components/ui/Combobox'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import type { FieldGroupProps } from './FieldGroupTypes'

const ADDRESS_PLACEHOLDERS: Record<string, string> = {
  wine: 'e.g., Willow Glen Winery, St. Helena, CA',
  distilled_spirits: 'e.g., Beam Suntory, Clermont, KY',
  malt_beverage: 'e.g., Blue Harbor Brewing Co., San Diego, CA',
}

export function ProducerInfoFields({
  beverageType,
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register, watch, setValue } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Producer Information</legend>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nameAndAddress" className="flex items-center gap-1.5">
            <FieldLabel fieldName="name_and_address">
              Name and Address
            </FieldLabel>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="name_and_address"
            />
          </Label>
          <Textarea
            id="nameAndAddress"
            rows={3}
            placeholder={
              beverageType
                ? ADDRESS_PLACEHOLDERS[beverageType]
                : 'e.g., Beam Suntory, Clermont, KY'
            }
            className={cn(
              extraction.aiOriginalValues.has('name_and_address') &&
                !extraction.modifiedFields.has('name_and_address') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('nameAndAddress', {
              onChange: () => onFieldChange('name_and_address'),
            })}
            onFocus={() => onFieldFocus('name_and_address')}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="qualifyingPhrase"
              className="flex items-center gap-1.5"
            >
              <FieldLabel fieldName="qualifying_phrase">
                Qualifying Phrase
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="qualifying_phrase"
              />
            </Label>
            <Combobox
              id="qualifyingPhrase"
              options={QUALIFYING_PHRASES.map((phrase) => ({
                value: phrase,
                label: phrase,
              }))}
              value={watch('qualifyingPhrase') || ''}
              onValueChange={(value) => {
                setValue('qualifyingPhrase', value, {
                  shouldValidate: true,
                })
                onFieldChange('qualifying_phrase')
              }}
              placeholder="Search phrases..."
              onFocus={() => onFieldFocus('qualifying_phrase')}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="countryOfOrigin"
              className="flex items-center gap-1.5"
            >
              <FieldLabel fieldName="country_of_origin">
                Country of Origin
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="country_of_origin"
              />
            </Label>
            <Input
              id="countryOfOrigin"
              placeholder="e.g., United States"
              className={cn(
                extraction.aiOriginalValues.has('country_of_origin') &&
                  !extraction.modifiedFields.has('country_of_origin') &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20',
              )}
              {...register('countryOfOrigin', {
                onChange: () => onFieldChange('country_of_origin'),
              })}
              onFocus={() => onFieldFocus('country_of_origin')}
            />
          </div>
        </div>
      </div>
    </fieldset>
  )
}
