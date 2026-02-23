'use client'

import { useState } from 'react'
import { useQueryState } from 'nuqs'
import { RotateCcw } from 'lucide-react'

import { HowItWorks } from '@/components/submit/how-it-works'
import { LabelUploadForm } from '@/components/validation/label-upload-form'
import { ApplicantBatchUpload } from '@/components/batch/applicant-batch-upload'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useExtractionStore } from '@/stores/extraction-store'
import { useNavigationGuard } from '@/hooks/use-navigation-guard'

export function SubmitPageTabs() {
  const [tab, setTab] = useQueryState('tab', {
    defaultValue: 'single',
    shallow: false,
  })
  const [resetKey, setResetKey] = useState(0)
  const [hasFiles, setHasFiles] = useState(false)
  const extraction = useExtractionStore()

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
      <Tabs value={tab} onValueChange={setTab}>
        {/* Header: title left, tabs or Start Fresh right — single row */}
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
          <div className="flex shrink-0 items-center gap-2">
            {isLocked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartFresh}
              >
                <RotateCcw className="size-3.5" />
                Start Fresh
              </Button>
            ) : (
              <TabsList>
                <TabsTrigger value="single">Single Label</TabsTrigger>
                <TabsTrigger value="batch">Batch Upload</TabsTrigger>
              </TabsList>
            )}
          </div>
        </div>

        {tab === 'single' && <HowItWorks />}

        <TabsContent value="single" className="mt-3">
          <LabelUploadForm
            key={resetKey}
            mode="submit"
            onActiveChange={(active) => setHasFiles(active)}
          />
        </TabsContent>
        <TabsContent value="batch" className="mt-3">
          <ApplicantBatchUpload />
        </TabsContent>
      </Tabs>

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
