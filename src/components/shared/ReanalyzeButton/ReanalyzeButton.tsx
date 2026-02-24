'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'

import { reanalyzeLabel } from '@/app/actions/reanalyze-label'
import { useReanalysisStore } from '@/stores/useReanalysisStore'
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
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog'

interface ReanalyzeButtonProps {
  labelId: string
}

export function ReanalyzeButton({ labelId }: ReanalyzeButtonProps) {
  const router = useRouter()
  const { startReanalyzing, stopReanalyzing } = useReanalysisStore()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const isReanalyzing = useReanalysisStore((s) => s.activeIds.has(labelId))

  function handleConfirm() {
    setError(null)
    setOpen(false)

    // Mark as reanalyzing — the ReanalysisGuard will show ProcessingPipelineCard
    startReanalyzing(labelId)

    // Fire the action in the background (don't block the UI)
    reanalyzeLabel(labelId)
      .then((result) => {
        stopReanalyzing(labelId)
        if (!result.success) {
          console.error('Reanalysis failed:', result.error)
        }
        router.refresh()
      })
      .catch(() => {
        stopReanalyzing(labelId)
        router.refresh()
      })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isReanalyzing}>
          {isReanalyzing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isReanalyzing ? 'Analyzing...' : 'Re-Analyze'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-Analyze Label</AlertDialogTitle>
          <AlertDialogDescription>
            This will re-run AI text extraction and field classification on the
            label images. Previous results will be superseded. No new
            notification will be sent to the applicant. Typically takes 10-20
            seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Re-Analyze
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
