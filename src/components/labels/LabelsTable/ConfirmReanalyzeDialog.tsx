'use client'

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

interface ConfirmReanalyzeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  error: string | null
}

export function ConfirmReanalyzeDialog({
  open,
  onOpenChange,
  onConfirm,
  error,
}: ConfirmReanalyzeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-Analyze Label</AlertDialogTitle>
          <AlertDialogDescription>
            This will re-run AI text extraction and field classification on the
            label images. Previous results will be superseded. No new
            notification will be sent to the applicant. Typically takes 2-4
            seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Re-Analyze</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
