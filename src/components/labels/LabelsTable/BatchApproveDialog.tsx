'use client'

import { Check, Loader2 } from 'lucide-react'

import { pluralize } from '@/lib/pluralize'
import { Button } from '@/components/ui/Button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog'

interface BatchApproveDialogProps {
  open: boolean
  running: boolean
  selectedCount: number
  result: { approvedCount: number; failedIds: string[] } | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onClose: () => void
}

export function BatchApproveDialog({
  open,
  running,
  selectedCount,
  result,
  onOpenChange,
  onConfirm,
  onClose,
}: BatchApproveDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !running) onClose()
        else onOpenChange(o)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Approve {pluralize(selectedCount, 'Label')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result
              ? `${pluralize(result.approvedCount, 'label')} approved${result.failedIds.length > 0 ? ` — ${result.failedIds.length} failed` : ''}`
              : `All selected labels have been verified by AI with high confidence and all fields match. This will approve them in bulk with an audit trail.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {running ? (
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              Approving...
            </Button>
          ) : result ? (
            <AlertDialogAction onClick={onClose}>Done</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>
                <Check className="size-4" />
                Approve {pluralize(selectedCount, 'Label')}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
