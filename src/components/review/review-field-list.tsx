'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, SearchX, Loader2, Send } from 'lucide-react'

import { submitReview } from '@/app/actions/submit-review'
import { FieldComparisonRow } from '@/components/shared/field-comparison-row'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationItemData {
  id: string
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: string
  confidence: string
  matchReasoning: string | null
  bboxX: string | null
  bboxY: string | null
  bboxWidth: string | null
  bboxHeight: string | null
}

type ResolvedStatus = 'match' | 'mismatch' | 'not_found'

interface FieldOverride {
  resolvedStatus: ResolvedStatus
  reviewerNotes: string
}

interface ReviewFieldListProps {
  labelId: string
  validationItems: ValidationItemData[]
  activeField: string | null
  onFieldClick: (fieldName: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLAGGED_STATUSES = new Set(['needs_correction', 'mismatch', 'not_found'])

const RESOLVE_OPTIONS: Array<{
  status: ResolvedStatus
  label: string
  icon: React.ReactNode
  className: string
  activeClassName: string
}> = [
  {
    status: 'match',
    label: 'Confirm Match',
    icon: <CheckCircle2 className="size-4" />,
    className:
      'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950',
    activeClassName:
      'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300',
  },
  {
    status: 'mismatch',
    label: 'Mark Mismatch',
    icon: <XCircle className="size-4" />,
    className:
      'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950',
    activeClassName:
      'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300',
  },
  {
    status: 'not_found',
    label: 'Mark Not Found',
    icon: <SearchX className="size-4" />,
    className:
      'border-border text-muted-foreground hover:bg-muted dark:hover:bg-muted/50',
    activeClassName: 'bg-muted border-foreground/20 text-foreground',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewFieldList({
  labelId,
  validationItems,
  activeField,
  onFieldClick,
}: ReviewFieldListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Track overrides for flagged fields only
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({})

  const flaggedItems = validationItems.filter((item) =>
    FLAGGED_STATUSES.has(item.status),
  )
  const matchedItems = validationItems.filter(
    (item) => !FLAGGED_STATUSES.has(item.status),
  )

  const allFlaggedResolved = flaggedItems.every(
    (item) => overrides[item.id]?.resolvedStatus !== undefined,
  )

  const handleOverrideStatus = (itemId: string, status: ResolvedStatus) => {
    setOverrides((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        resolvedStatus: status,
        reviewerNotes: prev[itemId]?.reviewerNotes ?? '',
      },
    }))
  }

  const handleOverrideNotes = (itemId: string, notes: string) => {
    setOverrides((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        resolvedStatus: prev[itemId]?.resolvedStatus ?? 'match',
        reviewerNotes: notes,
      },
    }))
  }

  const handleSubmit = () => {
    setError(null)

    const overrideEntries = flaggedItems
      .filter((item) => overrides[item.id]?.resolvedStatus !== undefined)
      .map((item) => ({
        validationItemId: item.id,
        originalStatus: item.status,
        resolvedStatus: overrides[item.id].resolvedStatus,
        reviewerNotes: overrides[item.id].reviewerNotes || undefined,
      }))

    if (overrideEntries.length === 0) {
      setError('Please resolve at least one flagged field before submitting.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('labelId', labelId)
      formData.set('overrides', JSON.stringify(overrideEntries))

      const result = await submitReview(formData)

      if (result.success) {
        router.push('/review')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Flagged fields — require resolution */}
      {flaggedItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">
            Flagged Fields ({flaggedItems.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Resolve each flagged field by confirming the AI result or overriding
            it with the correct status.
          </p>
          {flaggedItems.map((item) => {
            const override = overrides[item.id]

            return (
              <div key={item.id} className="space-y-3">
                <FieldComparisonRow
                  fieldName={item.fieldName}
                  expectedValue={item.expectedValue}
                  extractedValue={
                    item.status === 'not_found' ? null : item.extractedValue
                  }
                  status={override?.resolvedStatus ?? item.status}
                  confidence={Number(item.confidence)}
                  reasoning={item.matchReasoning}
                  isActive={activeField === item.fieldName}
                  onClick={() => onFieldClick(item.fieldName)}
                />

                {/* Override controls */}
                <div className="ml-4 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {RESOLVE_OPTIONS.map((option) => {
                      const isSelected =
                        override?.resolvedStatus === option.status

                      return (
                        <Button
                          key={option.status}
                          variant="outline"
                          size="sm"
                          className={cn(
                            'gap-1.5',
                            isSelected
                              ? option.activeClassName
                              : option.className,
                          )}
                          onClick={() =>
                            handleOverrideStatus(item.id, option.status)
                          }
                        >
                          {option.icon}
                          {option.label}
                        </Button>
                      )
                    })}
                  </div>

                  {override?.resolvedStatus !== undefined && (
                    <Textarea
                      placeholder="Optional reviewer notes..."
                      value={override.reviewerNotes}
                      onChange={(e) =>
                        handleOverrideNotes(item.id, e.target.value)
                      }
                      rows={2}
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Matched fields — read-only */}
      {matchedItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">
            Matched Fields ({matchedItems.length})
          </h2>
          {matchedItems.map((item) => (
            <FieldComparisonRow
              key={item.id}
              fieldName={item.fieldName}
              expectedValue={item.expectedValue}
              extractedValue={
                item.status === 'not_found' ? null : item.extractedValue
              }
              status={item.status}
              confidence={Number(item.confidence)}
              reasoning={item.matchReasoning}
              isActive={activeField === item.fieldName}
              onClick={() => onFieldClick(item.fieldName)}
            />
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Submit button */}
      <div className="sticky bottom-0 border-t bg-background pt-4 pb-2">
        <Button
          size="lg"
          className="w-full"
          disabled={!allFlaggedResolved || isPending}
          onClick={handleSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting Review...
            </>
          ) : (
            <>
              <Send className="size-4" />
              Complete Review
              {!allFlaggedResolved && (
                <span className="text-xs opacity-70">
                  ({flaggedItems.length - Object.keys(overrides).length}{' '}
                  remaining)
                </span>
              )}
            </>
          )}
        </Button>
        {!allFlaggedResolved && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Resolve all {flaggedItems.length} flagged fields to enable
            submission.
          </p>
        )}
      </div>
    </div>
  )
}
