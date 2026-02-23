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
import { updateApprovalThreshold } from '@/app/actions/update-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalThresholdProps {
  defaultValue: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalThreshold({ defaultValue }: ApprovalThresholdProps) {
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
          const result = await updateApprovalThreshold(newValue)
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
        setValue(80)
        return
      }
      const num = Math.min(100, Math.max(80, Number(raw)))
      if (Number.isNaN(num)) return
      setValue(num)
      save(num)
    },
    [save],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Approval Threshold</CardTitle>
        <CardDescription>
          Minimum confidence score for labels to appear in the &quot;Ready to
          Approve&quot; queue. Labels meeting this threshold with all fields
          matching can be batch-approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="approval-threshold" className="sr-only">
              Approval Threshold
            </Label>
            <Slider
              id="approval-threshold"
              value={[value]}
              onValueChange={handleSliderChange}
              min={80}
              max={100}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={value}
              onChange={handleInputChange}
              min={80}
              max={100}
              className="w-20 font-mono"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Range: 80%–100%. Higher values are stricter — fewer labels qualify
            for batch approval but with higher accuracy.
          </p>
          <div className="h-5 text-sm">
            {isPending && (
              <span className="text-muted-foreground">Saving...</span>
            )}
            {saved && (
              <span className="text-green-600 dark:text-green-400">Saved</span>
            )}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
