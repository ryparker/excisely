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

export function CommonFields({
  showSplitPane,
  onFieldFocus,
  onFieldChange,
}: FieldGroupProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ValidateLabelInput>()

  const extraction = useExtractionStore()

  return (
    <>
      {/* Brand Name + Fanciful Name — primary identifiers */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">Primary Identifiers</legend>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brandName" className="flex items-center gap-1.5">
              <FieldLabel fieldName="brand_name">
                Brand Name
              </FieldLabel>{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="brand_name"
              />
            </Label>
            <Input
              id="brandName"
              placeholder="e.g., Maker's Mark"
              aria-required="true"
              className={cn(
                extraction.aiOriginalValues.has('brand_name') &&
                  !extraction.modifiedFields.has('brand_name') &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20',
              )}
              {...register('brandName', {
                onChange: () => onFieldChange('brand_name'),
              })}
              onFocus={() => onFieldFocus('brand_name')}
              aria-invalid={!!errors.brandName}
            />
            {errors.brandName && (
              <p className="text-sm text-destructive">
                {errors.brandName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fancifulName" className="flex items-center gap-1.5">
              <FieldLabel fieldName="fanciful_name">
                Fanciful Name
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="fanciful_name"
              />
            </Label>
            <Input
              id="fancifulName"
              placeholder="Optional"
              className={cn(
                extraction.aiOriginalValues.has('fanciful_name') &&
                  !extraction.modifiedFields.has('fanciful_name') &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20',
              )}
              {...register('fancifulName', {
                onChange: () => onFieldChange('fanciful_name'),
              })}
              onFocus={() => onFieldFocus('fanciful_name')}
            />
          </div>
        </div>
      </fieldset>

      {/* Serial Number + Class/Type Designation */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">Application Identification</legend>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              placeholder="e.g., 12345678"
              {...register('serialNumber')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="classType" className="flex items-center gap-1.5">
              <FieldLabel fieldName="class_type">
                Class/Type Designation
              </FieldLabel>
              <AiFieldIndicator
                showSplitPane={showSplitPane}
                onFieldFocus={onFieldFocus}
                fieldName="class_type"
              />
            </Label>
            <Input
              id="classType"
              placeholder="e.g., Kentucky Straight Bourbon Whisky"
              className={cn(
                extraction.aiOriginalValues.has('class_type') &&
                  !extraction.modifiedFields.has('class_type') &&
                  'bg-indigo-50/50 dark:bg-indigo-950/20',
              )}
              {...register('classType', {
                onChange: () => onFieldChange('class_type'),
              })}
              onFocus={() => onFieldFocus('class_type')}
            />
          </div>
        </div>
      </fieldset>
    </>
  )
}
