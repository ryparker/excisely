'use client'

import { useCallback, useState } from 'react'

import { useSettingsSave } from '@/hooks/useSettingsSave'
import { SaveFeedback } from '@/components/shared/SaveFeedback'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/Switch'
import { Label } from '@/components/ui/Label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { updateAutoApproval } from '@/app/actions/update-settings'

interface AutoApprovalToggleProps {
  defaultValue: boolean
}

export function AutoApprovalToggle({ defaultValue }: AutoApprovalToggleProps) {
  const [enabled, setEnabled] = useState(defaultValue)
  const { isPending, saved, error, save } = useSettingsSave({ debounceMs: 0 })

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked)
      save(async () => {
        const result = await updateAutoApproval(checked)
        if (!result.success) {
          setEnabled(!checked) // revert on error
        }
        return result
      })
    },
    [save],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Approval</CardTitle>
        <CardDescription>
          Control whether AI-verified labels can be automatically approved
          without specialist review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor="auto-approval" className="flex-1 cursor-pointer">
              <span className="text-sm font-normal text-muted-foreground">
                {enabled
                  ? 'Labels where AI finds all fields matching will be automatically approved without specialist review.'
                  : 'All labels will be routed to a specialist for review, regardless of AI assessment.'}
              </span>
            </Label>
            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className={cn(
                  'text-xs font-medium',
                  enabled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground',
                )}
              >
                {enabled ? 'On' : 'Off'}
              </span>
              <Switch
                id="auto-approval"
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={isPending}
              />
            </div>
          </div>
          <SaveFeedback isPending={isPending} saved={saved} error={error} />
        </div>
      </CardContent>
    </Card>
  )
}
