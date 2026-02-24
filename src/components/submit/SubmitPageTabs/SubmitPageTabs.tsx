'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import { HowItWorks } from '@/components/submit/HowItWorks'
import { SampleData } from '@/components/submit/SampleData'
import { LabelUploadForm } from '@/components/validation/LabelUploadForm'
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
import { useExtractionStore } from '@/stores/useExtractionStore'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'

export function SubmitPageTabs() {
  const [resetKey, setResetKey] = useState(0)
  const [hasFiles, setHasFiles] = useState(false)
  const extraction = useExtractionStore()

  // Reset extraction store on mount so returning after a submission starts clean
  useEffect(() => {
    if (extraction.status !== 'idle') {
      extraction.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, [])

  const isLocked = hasFiles || extraction.status !== 'idle'

  const { showDialog, confirmNavigation, cancelNavigation } =
    useNavigationGuard({ shouldBlock: isLocked })

  function handleStartFresh() {
    setResetKey((k) => k + 1)
    extraction.reset()
    setHasFiles(false)
  }

  function handleConfirmLeave() {
    extraction.reset()
    confirmNavigation()
  }

  return (
    <>
      {/* Header: title left, Start Fresh right — single row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Submit Label Application
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Submit a label image with your Form 5100.31 application data for
            automated verification.
          </p>
        </div>
        {isLocked && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleStartFresh}
            >
              <RotateCcw className="size-3.5" />
              Start Fresh
            </Button>
          </div>
        )}
      </div>

      <HowItWorks />

      <div className="hidden md:block">
        {extraction.status === 'idle' && <SampleData />}
      </div>

      <div className="mt-3">
        <LabelUploadForm
          key={resetKey}
          mode="submit"
          onActiveChange={(active) => setHasFiles(active)}
        />
      </div>

      <AlertDialog open={showDialog} onOpenChange={cancelNavigation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              Your uploaded images and form data haven&apos;t been submitted
              yet. If you leave now, you&apos;ll lose all progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Keep Working
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmLeave}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
