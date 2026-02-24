'use client'

import { useFormContext } from 'react-hook-form'

import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { FieldLabel } from '@/components/shared/FieldLabel'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

interface HealthWarningFieldProps {
  onFieldFocus: (snakeCase: string) => void
}

export function HealthWarningField({ onFieldFocus }: HealthWarningFieldProps) {
  const { register } = useFormContext<ValidateLabelInput>()

  return (
    <div className="space-y-2">
      <Label htmlFor="healthWarning">
        <FieldLabel fieldName="health_warning">
          Health Warning Statement
        </FieldLabel>
      </Label>
      <Textarea
        id="healthWarning"
        rows={4}
        className="font-mono text-xs"
        {...register('healthWarning')}
        onFocus={() => onFieldFocus('health_warning')}
      />
      <p className="text-xs text-muted-foreground">
        Pre-filled with the standard GOVERNMENT WARNING per 27 CFR Part 16.
      </p>
    </div>
  )
}
