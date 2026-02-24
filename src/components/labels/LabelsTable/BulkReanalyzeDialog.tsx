'use client'

import { Loader2 } from 'lucide-react'

import { pluralize } from '@/lib/pluralize'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
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

import type { BulkItemStatus } from './LabelsTableTypes'

interface BulkReanalyzeDialogProps {
  open: boolean
  running: boolean
  selectedCount: number
  progress: Map<string, BulkItemStatus>
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onClose: () => void
}

export function BulkReanalyzeDialog({
  open,
  running,
  selectedCount,
  progress,
  onOpenChange,
  onConfirm,
  onClose,
}: BulkReanalyzeDialogProps) {
  const bulkTotal = progress.size
  const bulkCompleted = Array.from(progress.values()).filter(
    (s) => s === 'success' || s === 'error',
  ).length
  const bulkErrors = Array.from(progress.values()).filter(
    (s) => s === 'error',
  ).length
  const bulkPercent =
    bulkTotal > 0 ? Math.round((bulkCompleted / bulkTotal) * 100) : 0

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
            Re-Analyze {pluralize(selectedCount, 'Label')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bulkTotal === 0
              ? `This will re-run the AI pipeline on each selected label. Processing 3 at a time.`
              : `Completed ${bulkCompleted} of ${bulkTotal}${bulkErrors > 0 ? ` \u2014 ${pluralize(bulkErrors, 'error')}` : ''}`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {bulkTotal > 0 && (
          <div className="py-2">
            <Progress value={bulkPercent} className="h-2" />
          </div>
        )}

        <AlertDialogFooter>
          {running ? (
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              Processing...
            </Button>
          ) : bulkCompleted > 0 ? (
            <AlertDialogAction onClick={onClose}>Done</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>
                Re-Analyze {pluralize(selectedCount, 'Label')}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
