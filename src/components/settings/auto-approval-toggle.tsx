'use client'

import { useCallback, useState, useTransition } from 'react'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { updateAutoApproval } from '@/app/actions/update-settings'

interface AutoApprovalToggleProps {
  defaultValue: boolean
}

export function AutoApprovalToggle({ defaultValue }: AutoApprovalToggleProps) {
  const [enabled, setEnabled] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked)
      startTransition(async () => {
        setError(null)
        setSaved(false)
        const result = await updateAutoApproval(checked)
        if (result.success) {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        } else {
          setError(result.error)
          setEnabled(!checked)
        }
      })
    },
    [startTransition],
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
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-approval" className="flex-1 cursor-pointer">
              <span className="font-medium">
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                {enabled
                  ? 'Labels where AI finds all fields matching will be automatically approved without specialist review.'
                  : 'All labels will be routed to a specialist for review, regardless of AI assessment.'}
              </p>
            </Label>
            <Switch
              id="auto-approval"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>
          {enabled && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              When enabled, labels where AI finds all fields matching will be
              automatically approved without specialist review.
            </p>
          )}
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
