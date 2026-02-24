'use client'

import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { AlertTriangle, CheckCircle } from 'lucide-react'

import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { FieldLabel } from '@/components/shared/FieldLabel'
import { BEVERAGE_TYPES, isValidSize } from '@/config/beverage-types'
import { getCodesByBeverageType } from '@/config/class-type-codes'
import { cn } from '@/lib/utils'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

export function VolumeAndClassFields() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<ValidateLabelInput>()

  const beverageType = watch('beverageType')
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
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="classTypeCode">
          <FieldLabel fieldName="class_type">Class/Type Code</FieldLabel>
        </Label>
        <Select
          value={watch('classTypeCode') || ''}
          onValueChange={(value) =>
            setValue('classTypeCode', value, { shouldValidate: true })
          }
          disabled={!beverageType}
        >
          <SelectTrigger id="classTypeCode" className="w-full">
            <SelectValue
              placeholder={
                beverageType ? 'Select a code' : 'Select a beverage type first'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {filteredCodes.map((code) => (
              <SelectItem key={code.code} value={code.code}>
                {code.code} — {code.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="containerSizeMl" className="flex items-center gap-1.5">
          <FieldLabel fieldName="standards_of_fill">
            Total Bottle Capacity (mL)
          </FieldLabel>
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="containerSizeMl"
          type="number"
          min={1}
          placeholder="e.g., 750"
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
  )
}
