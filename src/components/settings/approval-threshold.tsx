'use client'

import { useCallback, useState } from 'react'

import { useSettingsSave } from '@/hooks/use-settings-save'
import { SaveFeedback } from '@/components/shared/save-feedback'
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
  const { isPending, saved, error, save } = useSettingsSave()

  const saveValue = useCallback(
    (newValue: number) => {
      save(() => updateApprovalThreshold(newValue))
    },
    [save],
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
        setValue(80)
        return
      }
      const num = Math.min(100, Math.max(80, Number(raw)))
      if (Number.isNaN(num)) return
      setValue(num)
      saveValue(num)
    },
    [saveValue],
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
          <SaveFeedback isPending={isPending} saved={saved} error={error} />
        </div>
      </CardContent>
    </Card>
  )
}
