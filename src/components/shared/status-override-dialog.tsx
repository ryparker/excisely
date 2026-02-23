'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ShieldAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import { overrideStatus } from '@/app/actions/override-status'
import { OVERRIDE_REASONS } from '@/config/override-reasons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/status-badge'

const FINAL_STATUSES = [
  { value: 'approved', label: 'Approved' },
  { value: 'conditionally_approved', label: 'Conditionally Approved' },
  { value: 'needs_correction', label: 'Needs Correction' },
  { value: 'rejected', label: 'Rejected' },
] as const

interface StatusOverrideDialogProps {
  labelId: string
  currentStatus: string
}

export function StatusOverrideDialog({
  labelId,
  currentStatus,
}: StatusOverrideDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [justification, setJustification] = useState('')
  const [selectedReasonCode, setSelectedReasonCode] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const availableStatuses = FINAL_STATUSES.filter(
    (s) => s.value !== currentStatus,
  )

  const isValid = newStatus !== '' && justification.length >= 10

  function resetState() {
    setNewStatus('')
    setJustification('')
    setSelectedReasonCode(null)
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetState()
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await overrideStatus({
        labelId,
        newStatus: newStatus as
          | 'approved'
          | 'conditionally_approved'
          | 'needs_correction'
          | 'rejected',
        justification,
        reasonCode: selectedReasonCode,
      })

      if (result.success) {
        setOpen(false)
        resetState()
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldAlert className="size-4" />
          Override Status
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Status Override</DialogTitle>
          <DialogDescription>
            Change this label&apos;s status with a justification. This action is
            recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current → New status row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Current Status
              </label>
              <div>
                <StatusBadge status={currentStatus} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                New Status
              </label>
              <Select
                value={newStatus}
                onValueChange={(v) => {
                  setNewStatus(v)
                  setJustification('')
                  setSelectedReasonCode(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Justification */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Justification
            </label>

            {/* Preset reason pills */}
            {newStatus && OVERRIDE_REASONS[newStatus] && (
              <div className="flex flex-wrap gap-1.5">
                {OVERRIDE_REASONS[newStatus].map((reason) => {
                  const isSelected = selectedReasonCode === reason.code
                  return (
                    <button
                      key={reason.code}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setJustification('')
                          setSelectedReasonCode(null)
                        } else {
                          setJustification(reason.description)
                          setSelectedReasonCode(reason.code)
                        }
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                      {reason.label}
                    </button>
                  )
                })}
              </div>
            )}

            <Textarea
              placeholder={
                newStatus
                  ? 'Select a reason above or write your own...'
                  : 'Select a status first...'
              }
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value)
                setSelectedReasonCode(null)
              }}
              rows={3}
              disabled={!newStatus}
            />
            {justification.length > 0 && justification.length < 10 && (
              <p className="text-xs text-muted-foreground">
                {10 - justification.length} more characters needed
              </p>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            {isPending ? 'Overriding...' : 'Confirm Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
