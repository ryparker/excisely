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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brandName" className="flex items-center gap-1.5">
            <FieldLabel fieldName="brand_name">Brand Name (Item 6)</FieldLabel>{' '}
            <span className="text-destructive">*</span>
            <AiFieldIndicator
              showSplitPane={showSplitPane}
              onFieldFocus={onFieldFocus}
              fieldName="brand_name"
            />
          </Label>
          <Input
            id="brandName"
            placeholder="e.g., Maker's Mark"
            className={cn(
              extraction.aiOriginalValues.has('brand_name') &&
                !extraction.modifiedFields.has('brand_name') &&
                'bg-indigo-50/50 dark:bg-indigo-950/20',
            )}
            {...register('brandName')}
            onFocus={() => onFieldFocus('brand_name')}
            onChange={(e) => {
              register('brandName').onChange(e)
              onFieldChange('brand_name')
            }}
            aria-invalid={!!errors.brandName}
          />
          {errors.brandName && (
            <p className="text-sm text-destructive">
              {errors.brandName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fancifulName" className="flex items-center gap-1.5">
            <FieldLabel fieldName="fanciful_name">
              Fanciful Name (Item 7)
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
            {...register('fancifulName')}
            onFocus={() => onFieldFocus('fanciful_name')}
            onChange={(e) => {
              register('fancifulName').onChange(e)
              onFieldChange('fanciful_name')
            }}
          />
        </div>
      </div>

      {/* Serial Number + Class/Type Designation */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number (Item 4)</Label>
          <Input
            id="serialNumber"
            placeholder="e.g., 12345678"
            {...register('serialNumber')}
          />
        </div>

        <div className="space-y-2">
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
            {...register('classType')}
            onFocus={() => onFieldFocus('class_type')}
            onChange={(e) => {
              register('classType').onChange(e)
              onFieldChange('class_type')
            }}
          />
        </div>
      </div>
    </>
  )
}
