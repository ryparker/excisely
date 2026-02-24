'use client'

import { useFormContext } from 'react-hook-form'

import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { AiFieldIndicator } from '@/components/validation/AiFieldIndicator'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { useExtractionStore } from '@/stores/useExtractionStore'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'
import type { FieldGroupProps } from './FieldGroupTypes'

export function ProducerInfoFields({
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const { register, watch, setValue } = useFormContext<ValidateLabelInput>()
  const extraction = useExtractionStore()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="nameAndAddress" className="flex items-center gap-1.5">
          <FieldLabel fieldName="name_and_address">
            Name and Address (Item 8)
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
          placeholder="e.g., Beam Suntory, Clermont, KY"
          className={cn(
            extraction.aiOriginalValues.has('name_and_address') &&
              !extraction.modifiedFields.has('name_and_address') &&
              'bg-indigo-50/50 dark:bg-indigo-950/20',
          )}
          {...register('nameAndAddress')}
          onFocus={() => onFieldFocus('name_and_address')}
          onChange={(e) => {
            register('nameAndAddress').onChange(e)
            onFieldChange('name_and_address')
          }}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
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
          <Select
            value={watch('qualifyingPhrase') || ''}
            onValueChange={(value) => {
              setValue('qualifyingPhrase', value, {
                shouldValidate: true,
              })
              onFieldChange('qualifying_phrase')
            }}
          >
            <SelectTrigger
              id="qualifyingPhrase"
              className="w-full"
              onFocus={() => onFieldFocus('qualifying_phrase')}
            >
              <SelectValue placeholder="Select a phrase" />
            </SelectTrigger>
            <SelectContent>
              {QUALIFYING_PHRASES.map((phrase) => (
                <SelectItem key={phrase} value={phrase}>
                  {phrase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
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
            {...register('countryOfOrigin')}
            onFocus={() => onFieldFocus('country_of_origin')}
            onChange={(e) => {
              register('countryOfOrigin').onChange(e)
              onFieldChange('country_of_origin')
            }}
          />
        </div>
      </div>
    </div>
  )
}
