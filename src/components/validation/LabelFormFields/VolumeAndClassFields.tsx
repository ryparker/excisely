'use client'

import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { AlertTriangle, CheckCircle } from 'lucide-react'

import { Combobox } from '@/components/ui/Combobox'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { BEVERAGE_TYPES, isValidSize } from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { cn } from '@/lib/utils'
import type { BeverageType } from '@/config/beverage-types'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

interface VolumeAndClassFieldsProps {
  beverageType: BeverageType | undefined
}

export function VolumeAndClassFields({
  beverageType,
}: VolumeAndClassFieldsProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ValidateLabelInput>()

  const containerSizeMl = watch('containerSizeMl')

  const filteredCodes = useMemo(() => {
    if (!beverageType) return []
    return getCodesByBeverageType(beverageType)
  }, [beverageType])

  const standardsOfFillStatus = useMemo(() => {
    if (!beverageType || !containerSizeMl || containerSizeMl <= 0) return null

    if (beverageType === 'malt_beverage') {
      return { valid: true, message: 'Any size permitted' }
    }

    if (isValidSize(beverageType, containerSizeMl)) {
      return { valid: true, message: 'Valid standard of fill' }
    }

    const typeLabel = BEVERAGE_TYPES[beverageType].label
    return {
      valid: false,
      message: `Not a valid standard of fill for ${typeLabel}`,
    }
  }, [beverageType, containerSizeMl])

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">Volume and Classification</legend>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="classTypeCode">
            <FieldLabel fieldName="class_type">Class/Type Code</FieldLabel>
          </Label>
          <Combobox
            id="classTypeCode"
            options={filteredCodes.map((code) => ({
              value: code.code,
              label: `${code.code} — ${code.description}`,
            }))}
            value={watch('classTypeCode') || ''}
            onValueChange={(value) =>
              setValue('classTypeCode', value, { shouldValidate: true })
            }
            disabled={!beverageType}
            placeholder={
              beverageType ? 'Search codes...' : 'Select a beverage type first'
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="containerSizeMl"
            className="flex items-center gap-1.5"
          >
            <FieldLabel fieldName="standards_of_fill">
              Total Bottle Capacity (mL)
            </FieldLabel>
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="containerSizeMl"
            type="number"
            min={1}
            placeholder="e.g., 750"
            aria-required="true"
            {...register('containerSizeMl', { valueAsNumber: true })}
          />
          {errors.containerSizeMl && (
            <p className="text-sm text-destructive">
              {errors.containerSizeMl.message}
            </p>
          )}
          {standardsOfFillStatus && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm',
                standardsOfFillStatus.valid
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {standardsOfFillStatus.valid ? (
                <CheckCircle className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              {standardsOfFillStatus.message}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  )
}
