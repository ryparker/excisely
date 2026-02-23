'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

import { overrideStatus } from '@/app/actions/override-status'
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
  const [error, setError] = useState<string | null>(null)

  const availableStatuses = FINAL_STATUSES.filter(
    (s) => s.value !== currentStatus,
  )

  const isValid = newStatus !== '' && justification.length >= 10

  function resetState() {
    setNewStatus('')
    setJustification('')
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Status Override</DialogTitle>
          <DialogDescription>
            Change this label&apos;s status with a justification. This action is
            recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current status */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Status</label>
            <div>
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          {/* New status select */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Status</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status..." />
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

          {/* Justification */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Justification</label>
            <Textarea
              placeholder="Explain why this override is necessary (min 10 characters)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {justification.length}/10 characters minimum
            </p>
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
