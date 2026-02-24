'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
} from 'lucide-react'

import { routes } from '@/config/routes'
import { submitReview } from '@/app/actions/submit-review'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { pluralize } from '@/lib/pluralize'

interface ProjectedStatus {
  status: string
  deadlineDays?: number | null
}

interface ReviewSubmitButtonProps {
  labelId: string
  overrideEntries: Array<{
    validationItemId: string
    originalStatus: string
    resolvedStatus: string
    reviewerNotes?: string
    annotationData: {
      x: number
      y: number
      width: number
      height: number
    } | null
  }>
  allFlaggedResolved: boolean
  projectedStatus: ProjectedStatus | null
  flaggedCount: number
  unresolvedCount: number
  matchOverrideCount: number
}

export function ReviewSubmitButton({
  labelId,
  overrideEntries,
  allFlaggedResolved,
  projectedStatus,
  flaggedCount,
  unresolvedCount,
  matchOverrideCount,
}: ReviewSubmitButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  const handleSubmit = () => {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('labelId', labelId)
      formData.set('overrides', JSON.stringify(overrideEntries))

      const result = await submitReview(formData)

      if (result.success) {
        router.push(routes.home())
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      {error && (
        <div
          ref={errorRef}
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="sticky bottom-0 rounded-lg border bg-background/95 px-4 pt-4 pb-3 shadow-sm backdrop-blur-sm">
        <Button
          size="lg"
          className={cn(
            'w-full active:scale-[0.98]',
            projectedStatus?.status === 'rejected' &&
              'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
            projectedStatus?.status === 'needs_correction' &&
              'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700',
            projectedStatus?.status === 'conditionally_approved' &&
              'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600',
            projectedStatus?.status === 'approved' &&
              'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
          )}
          disabled={!allFlaggedResolved || isPending}
          onClick={handleSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting Review...
            </>
          ) : !allFlaggedResolved ? (
            <>
              <Send className="size-4" />
              Complete Review
              <span className="text-xs tabular-nums opacity-70">
                ({unresolvedCount} remaining)
              </span>
            </>
          ) : (
            <>
              {projectedStatus?.status === 'approved' && (
                <>
                  <CheckCircle2 className="size-4" />
                  Approve Label
                </>
              )}
              {projectedStatus?.status === 'conditionally_approved' && (
                <>
                  <AlertTriangle className="size-4" />
                  Conditionally Approve
                </>
              )}
              {projectedStatus?.status === 'needs_correction' && (
                <>
                  <XCircle className="size-4" />
                  Request Corrections
                </>
              )}
              {projectedStatus?.status === 'rejected' && (
                <>
                  <XCircle className="size-4" />
                  Reject Label
                </>
              )}
              {matchOverrideCount > 0 && (
                <span className="text-xs tabular-nums opacity-70">
                  (+{pluralize(matchOverrideCount, 'AI correction')})
                </span>
              )}
            </>
          )}
        </Button>
        {!allFlaggedResolved ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Resolve all {pluralize(flaggedCount, 'flagged field')} to enable
            submission.
          </p>
        ) : projectedStatus?.deadlineDays ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Applicant will have {projectedStatus.deadlineDays} days to submit
            corrections.
          </p>
        ) : null}
      </div>
    </>
  )
}
