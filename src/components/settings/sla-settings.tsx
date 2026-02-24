'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateSLATargets } from '@/app/actions/update-settings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import type { SLATargets } from '@/lib/settings/get-settings'

interface SLASettingsProps {
  defaults: SLATargets
}

export function SLASettings({ defaults }: SLASettingsProps) {
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<SLATargets>(defaults)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const latestValues = useRef<SLATargets>(defaults)

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const save = useCallback(
    (updated: SLATargets) => {
      latestValues.current = updated
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const result = await updateSLATargets(latestValues.current)
          if (!result.success) {
            toast.error(result.error)
          }
        })
      }, 500)
    },
    [startTransition],
  )

  const handleChange = useCallback(
    (key: keyof SLATargets, value: number) => {
      const updated = { ...values, [key]: value }
      setValues(updated)
      save(updated)
    },
    [values, save],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          SLA Targets
          {isPending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        <CardDescription>
          Configure service level agreement targets for label review turnaround.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Review Response Time */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="review-response-time">Review Response Time</Label>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {values.reviewResponseHours}h
            </span>
          </div>
          <Slider
            id="review-response-time"
            value={[values.reviewResponseHours]}
            min={1}
            max={168}
            step={1}
            onValueChange={([v]) => handleChange('reviewResponseHours', v)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum hours from pending review to reviewed (1-168h).
          </p>
        </div>

        {/* Total Turnaround Time */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="total-turnaround-time">Total Turnaround Time</Label>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {values.totalTurnaroundHours}h
            </span>
          </div>
          <Slider
            id="total-turnaround-time"
            value={[values.totalTurnaroundHours]}
            min={1}
            max={168}
            step={1}
            onValueChange={([v]) => handleChange('totalTurnaroundHours', v)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum hours from submission to final decision (1-168h).
          </p>
        </div>

        {/* Auto-Approval Rate Target */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-approval-rate">
              Auto-Approval Rate Target
            </Label>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {values.autoApprovalRateTarget}%
            </span>
          </div>
          <Slider
            id="auto-approval-rate"
            value={[values.autoApprovalRateTarget]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => handleChange('autoApprovalRateTarget', v)}
          />
          <p className="text-xs text-muted-foreground">
            Target percentage of labels auto-approved by AI without human
            review.
          </p>
        </div>

        {/* Max Queue Depth */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="maxQueueDepth">Max Queue Depth</Label>
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {values.maxQueueDepth}
            </span>
          </div>
          <Input
            id="maxQueueDepth"
            type="number"
            min={1}
            max={1000}
            value={values.maxQueueDepth}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 1 && v <= 1000) {
                handleChange('maxQueueDepth', v)
              }
            }}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Maximum pending review labels at any time (1-1000).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
