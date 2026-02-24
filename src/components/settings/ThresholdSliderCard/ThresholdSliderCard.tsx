'use client'

import { useCallback, useState, type ReactNode } from 'react'

import { useSettingsSave } from '@/hooks/useSettingsSave'
import { SaveFeedback } from '@/components/shared/SaveFeedback'
import { Slider } from '@/components/ui/Slider'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThresholdSliderCardProps {
  /** Card title displayed in the header */
  title: string
  /** Card description displayed below the title */
  description: string
  /** Minimum slider/input value */
  min: number
  /** Maximum slider/input value */
  max: number
  /** Slider step increment (default: 1) */
  step?: number
  /** Initial value for the slider */
  defaultValue: number
  /** Async function called when the value changes (debounced) */
  saveAction: (value: number) => Promise<{ success: boolean; error?: string }>
  /** Optional help text displayed below the slider */
  helpText?: string
  /** Optional content rendered as an overlay on the slider track (e.g. tick marks) */
  sliderOverlay?: ReactNode
  /** Optional content rendered below the slider row (e.g. a legend) */
  children?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThresholdSliderCard({
  title,
  description,
  min,
  max,
  step = 1,
  defaultValue,
  saveAction,
  helpText,
  sliderOverlay,
  children,
}: ThresholdSliderCardProps) {
  const [value, setValue] = useState(defaultValue)
  const { isPending, saved, error, save } = useSettingsSave()

  const sliderId = `threshold-${title.toLowerCase().replace(/\s+/g, '-')}`

  const saveValue = useCallback(
    (newValue: number) => {
      save(() => saveAction(newValue))
    },
    [save, saveAction],
  )

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const newValue = values[0] ?? defaultValue
      setValue(newValue)
      saveValue(newValue)
    },
    [defaultValue, saveValue],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        setValue(min)
        return
      }
      const num = Math.min(max, Math.max(min, Number(raw)))
      if (Number.isNaN(num)) return
      setValue(num)
      saveValue(num)
    },
    [min, max, saveValue],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor={sliderId} className="sr-only">
              {title}
            </Label>
            <div className="relative flex-1">
              <Slider
                id={sliderId}
                value={[value]}
                onValueChange={handleSliderChange}
                min={min}
                max={max}
                step={step}
              />
              {sliderOverlay}
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={value}
                onChange={handleInputChange}
                min={min}
                max={max}
                className="w-20 font-mono"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          {helpText && (
            <p className="text-xs text-muted-foreground">{helpText}</p>
          )}
          {children}
          <SaveFeedback isPending={isPending} saved={saved} error={error} />
        </div>
      </CardContent>
    </Card>
  )
}
