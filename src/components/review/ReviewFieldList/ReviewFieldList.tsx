'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SearchX,
  Loader2,
  Send,
  Flag,
} from 'lucide-react'

import { routes } from '@/config/routes'
import { submitReview } from '@/app/actions/submit-review'
import type { ApplicantCorrection } from '@/components/shared/ApplicantCorrectionBadge'
import {
  ReviewFieldItem,
  type ResolveOption,
} from '@/components/review/ReviewFieldItem'
import { Button } from '@/components/ui/Button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import { cn } from '@/lib/utils'
import { pluralize } from '@/lib/pluralize'
import {
  determineOverallStatus,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationItemData {
  id: string
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: ValidationItemStatus
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
  applicantCorrections?: ApplicantCorrection[]
  activeField: string | null
  onFieldClick: (fieldName: string) => void
  onMarkLocation?: (fieldName: string) => void
  onClearAnnotation?: (fieldName: string) => void
  annotations?: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >
  beverageType: BeverageType
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLAGGED_STATUSES = new Set(['needs_correction', 'mismatch', 'not_found'])

const RESOLVE_OPTIONS: ResolveOption[] = [
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

/** Matched fields show only mismatch + not_found (no "confirm match") */
const MATCHED_RESOLVE_OPTIONS = RESOLVE_OPTIONS.filter(
  (o) => o.status !== 'match',
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewFieldList({
  labelId,
  validationItems,
  applicantCorrections,
  activeField,
  onFieldClick,
  onMarkLocation,
  onClearAnnotation,
  annotations,
  beverageType,
}: ReviewFieldListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Scroll error into view when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [error])

  // Build corrections map: fieldName -> correction details
  const correctionsMap = useMemo(() => {
    const map = new Map<string, ApplicantCorrection>()
    if (applicantCorrections) {
      for (const c of applicantCorrections) {
        map.set(c.fieldName, c)
      }
    }
    return map
  }, [applicantCorrections])

  // Track overrides for flagged fields and manually flagged matched fields
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({})
  const [flaggedMatchIds, setFlaggedMatchIds] = useState<Set<string>>(new Set())

  const flaggedItems = validationItems.filter((item) =>
    FLAGGED_STATUSES.has(item.status),
  )
  const matchedItems = validationItems.filter(
    (item) => !FLAGGED_STATUSES.has(item.status),
  )

  const allFlaggedResolved = flaggedItems.every(
    (item) => overrides[item.id]?.resolvedStatus !== undefined,
  )

  // Compute projected label status based on current overrides
  const projectedStatus = (() => {
    if (!allFlaggedResolved) return null
    const finalStatuses = validationItems.map((item) => {
      const override = overrides[item.id]
      const isFlaggedMatch = flaggedMatchIds.has(item.id)
      return {
        fieldName: item.fieldName,
        status:
          isFlaggedMatch && override?.resolvedStatus
            ? override.resolvedStatus
            : (override?.resolvedStatus ?? item.status),
      }
    })
    return determineOverallStatus(finalStatuses, beverageType)
  })()

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

  const handleFlagMatch = (itemId: string) => {
    setFlaggedMatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
        // Clear override data when unflagging
        setOverrides((prevOverrides) => {
          const rest = { ...prevOverrides }
          delete rest[itemId]
          return rest
        })
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const matchOverrideCount = matchedItems.filter(
    (item) =>
      flaggedMatchIds.has(item.id) &&
      overrides[item.id]?.resolvedStatus !== undefined,
  ).length

  const errorRef = useRef<HTMLDivElement>(null)

  const handleSubmit = () => {
    setError(null)

    // Collect overrides from AI-flagged fields
    const flaggedOverrides = flaggedItems
      .filter((item) => overrides[item.id]?.resolvedStatus !== undefined)
      .map((item) => ({
        validationItemId: item.id,
        originalStatus: item.status,
        resolvedStatus: overrides[item.id].resolvedStatus,
        reviewerNotes: overrides[item.id].reviewerNotes || undefined,
        annotationData: annotations?.[item.fieldName] ?? null,
      }))

    // Collect overrides from specialist-flagged matched fields
    const matchOverrides = matchedItems
      .filter(
        (item) =>
          flaggedMatchIds.has(item.id) &&
          overrides[item.id]?.resolvedStatus !== undefined,
      )
      .map((item) => ({
        validationItemId: item.id,
        originalStatus: item.status,
        resolvedStatus: overrides[item.id].resolvedStatus,
        reviewerNotes: overrides[item.id].reviewerNotes || undefined,
        annotationData: annotations?.[item.fieldName] ?? null,
      }))

    const overrideEntries = [...flaggedOverrides, ...matchOverrides]

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
    <div className="space-y-6">
      {/* Flagged fields -- require resolution */}
      {flaggedItems.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="font-heading text-base font-semibold text-red-600 dark:text-red-400">
              Flagged Fields
              <span className="ml-1.5 text-sm font-normal text-red-600/60 tabular-nums dark:text-red-400/60">
                ({flaggedItems.length})
              </span>
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Resolve each flagged field by confirming the AI result or
              overriding it with the correct status.
            </p>
          </div>
          {flaggedItems.map((item) => {
            const override = overrides[item.id]

            return (
              <ReviewFieldItem
                key={item.id}
                variant="flagged"
                itemId={item.id}
                fieldName={item.fieldName}
                expectedValue={item.expectedValue}
                extractedValue={item.extractedValue}
                status={item.status}
                confidence={item.confidence}
                matchReasoning={item.matchReasoning}
                displayStatus={override?.resolvedStatus ?? item.status}
                isActive={activeField === item.fieldName}
                correction={correctionsMap.get(item.fieldName)}
                resolvedStatus={override?.resolvedStatus}
                reviewerNotes={override?.reviewerNotes ?? ''}
                resolveOptions={RESOLVE_OPTIONS}
                showOverrides
                annotations={annotations}
                onFieldClick={() => onFieldClick(item.fieldName)}
                onOverrideStatus={(status) =>
                  handleOverrideStatus(item.id, status as ResolvedStatus)
                }
                onOverrideNotes={(notes) => handleOverrideNotes(item.id, notes)}
                onMarkLocation={onMarkLocation}
                onClearAnnotation={onClearAnnotation}
              />
            )
          })}
        </div>
      )}

      {/* Matched fields -- flaggable by specialist */}
      {matchedItems.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="font-heading text-base font-semibold text-muted-foreground">
            Matched Fields
            <span className="ml-1.5 text-sm font-normal text-muted-foreground/50 tabular-nums">
              ({matchedItems.length})
            </span>
          </h2>
          {matchedItems.map((item) => {
            const isFlagged = flaggedMatchIds.has(item.id)
            const override = overrides[item.id]

            const flagAction = (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-md transition-colors',
                      isFlagged
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/60'
                        : 'text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground',
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFlagMatch(item.id)
                    }}
                    aria-label={
                      isFlagged ? 'Remove AI error flag' : 'Flag as AI error'
                    }
                  >
                    <Flag className="size-3.5" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-56 text-xs">
                  <p className="font-medium">
                    {isFlagged ? 'Remove flag' : 'Flag AI error'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {isFlagged
                      ? 'Click to unflag this field and remove the override.'
                      : 'Click to flag this match as incorrect. You can then override the AI result with the correct status.'}
                  </p>
                </HoverCardContent>
              </HoverCard>
            )

            return (
              <ReviewFieldItem
                key={item.id}
                variant="matched"
                itemId={item.id}
                fieldName={item.fieldName}
                expectedValue={item.expectedValue}
                extractedValue={item.extractedValue}
                status={item.status}
                confidence={item.confidence}
                matchReasoning={item.matchReasoning}
                displayStatus={
                  isFlagged
                    ? (override?.resolvedStatus ?? item.status)
                    : item.status
                }
                isActive={activeField === item.fieldName}
                correction={correctionsMap.get(item.fieldName)}
                resolvedStatus={override?.resolvedStatus}
                reviewerNotes={override?.reviewerNotes ?? ''}
                resolveOptions={MATCHED_RESOLVE_OPTIONS}
                showOverrides={isFlagged}
                annotations={annotations}
                headerAction={flagAction}
                onFieldClick={() => onFieldClick(item.fieldName)}
                onOverrideStatus={(status) =>
                  handleOverrideStatus(item.id, status as ResolvedStatus)
                }
                onOverrideNotes={(notes) => handleOverrideNotes(item.id, notes)}
                onMarkLocation={onMarkLocation}
                onClearAnnotation={onClearAnnotation}
              />
            )
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          ref={errorRef}
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Submit button */}
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
                ({flaggedItems.length - Object.keys(overrides).length}{' '}
                remaining)
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
            Resolve all {pluralize(flaggedItems.length, 'flagged field')} to
            enable submission.
          </p>
        ) : projectedStatus?.deadlineDays ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Applicant will have {projectedStatus.deadlineDays} days to submit
            corrections.
          </p>
        ) : null}
      </div>
    </div>
  )
}
