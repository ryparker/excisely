'use client'

import { useCallback, useRef, useState, useTransition } from 'react'

import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { updateConfidenceThreshold } from '@/app/actions/update-settings'

interface ConfidenceThresholdProps {
  defaultValue: number
  avgConfidence: number | null
  avgNotAutoApproved: number | null
}

function SliderTick({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-help flex-col items-center"
          style={{ left: `${value}%` }}
        >
          <div
            className="size-2.5 rounded-full border-2 border-white shadow-sm dark:border-zinc-900"
            style={{ backgroundColor: color }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-center">
        <p className="font-medium">{value}%</p>
        <p className="text-[10px] opacity-80">{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function ConfidenceThreshold({
  defaultValue,
  avgConfidence,
  avgNotAutoApproved,
}: ConfidenceThresholdProps) {
  const [value, setValue] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(
    (newValue: number) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          setError(null)
          setSaved(false)
          const result = await updateConfidenceThreshold(newValue)
          if (result.success) {
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } else {
            setError(result.error)
          }
        })
      }, 500)
    },
    [startTransition],
  )

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const newValue = values[0] ?? defaultValue
      setValue(newValue)
      save(newValue)
    },
    [defaultValue, save],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '') {
        setValue(0)
        return
      }
      const num = Math.min(100, Math.max(0, Number(raw)))
      if (Number.isNaN(num)) return
      setValue(num)
      save(num)
    },
    [save],
  )

  const hasTicks = avgConfidence !== null || avgNotAutoApproved !== null

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Confidence Threshold</CardTitle>
          <CardDescription>
            Minimum confidence score (0-100%) for automated approval. Labels
            below this threshold are flagged for specialist review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="confidence-threshold" className="sr-only">
                Confidence Threshold
              </Label>
              <div className="relative flex-1">
                <Slider
                  id="confidence-threshold"
                  value={[value]}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={100}
                  step={1}
                />
                {hasTicks && (
                  <div className="pointer-events-none absolute inset-0">
                    <div className="pointer-events-auto relative h-full">
                      {avgNotAutoApproved !== null && (
                        <SliderTick
                          value={avgNotAutoApproved}
                          label="Avg. flagged labels"
                          color="var(--color-destructive, #ef4444)"
                        />
                      )}
                      {avgConfidence !== null && (
                        <SliderTick
                          value={avgConfidence}
                          label="Avg. all labels"
                          color="var(--color-primary, #2563eb)"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Input
                type="number"
                value={value}
                onChange={handleInputChange}
                min={0}
                max={100}
                className="w-20 font-mono"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {hasTicks && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {avgConfidence !== null && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary, #2563eb)',
                      }}
                    />
                    Avg. all labels: {avgConfidence}%
                  </span>
                )}
                {avgNotAutoApproved !== null && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-destructive, #ef4444)',
                      }}
                    />
                    Avg. flagged labels: {avgNotAutoApproved}%
                  </span>
                )}
              </div>
            )}
            <div className="h-5 text-sm">
              {isPending && (
                <span className="text-muted-foreground">Saving...</span>
              )}
              {saved && (
                <span className="text-green-600 dark:text-green-400">
                  Saved
                </span>
              )}
              {error && <span className="text-destructive">{error}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
