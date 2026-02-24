'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SearchX,
  Loader2,
  Send,
  Crosshair,
  MapPin,
  Pencil,
  X,
  Flag,
} from 'lucide-react'

import { routes } from '@/config/routes'
import { submitReview } from '@/app/actions/submit-review'
import { FieldComparisonRow } from '@/components/shared/field-comparison-row'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
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

interface ApplicantCorrection {
  fieldName: string
  aiExtractedValue: string
  applicantSubmittedValue: string
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
  beverageType: string
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
// Applicant Correction Badge
// ---------------------------------------------------------------------------

function ApplicantCorrectionBadge({
  correction,
}: {
  correction: ApplicantCorrection
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className="ml-1 h-5 cursor-help gap-1 border-amber-200 px-1.5 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-400"
        >
          <Pencil className="size-2.5" />
          Applicant edited
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-72">
        <div className="space-y-2 text-xs">
          <p className="font-medium">
            The applicant changed the AI-extracted value for this field.
          </p>
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground">AI extracted: </span>
              <span className="font-mono">
                {correction.aiExtractedValue || '(empty)'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                Applicant submitted:{' '}
              </span>
              <span className="font-mono">
                {correction.applicantSubmittedValue || '(empty)'}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

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

  // Build corrections map: fieldName → correction details
  const correctionsMap = new Map<string, ApplicantCorrection>()
  if (applicantCorrections) {
    for (const c of applicantCorrections) {
      correctionsMap.set(c.fieldName, c)
    }
  }

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
        status: (isFlaggedMatch && override?.resolvedStatus
          ? override.resolvedStatus
          : (override?.resolvedStatus ?? item.status)) as ValidationItemStatus,
      }
    })
    return determineOverallStatus(finalStatuses, beverageType as BeverageType)
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
      {/* Flagged fields — require resolution */}
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
            const correction = correctionsMap.get(item.fieldName)

            return (
              <div key={item.id} className="space-y-3">
                <div className="space-y-1.5">
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
                  {correction && (
                    <ApplicantCorrectionBadge correction={correction} />
                  )}
                </div>

                {/* Override controls */}
                <div className="mt-1 ml-1 space-y-2.5 border-l-2 border-muted pl-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {RESOLVE_OPTIONS.map((option) => {
                      const isSelected =
                        override?.resolvedStatus === option.status

                      return (
                        <Button
                          key={option.status}
                          variant="outline"
                          size="sm"
                          className={cn(
                            'h-8 gap-1.5 text-xs',
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

                    {/* Mark Location on Image — inline */}
                    {onMarkLocation && (
                      <>
                        <div className="mx-1 h-5 w-px bg-border" />
                        {annotations?.[item.fieldName] ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 border-indigo-200 text-xs text-indigo-700 dark:border-indigo-800 dark:text-indigo-400"
                              onClick={() => onMarkLocation(item.fieldName)}
                            >
                              <MapPin className="size-3.5" />
                              Redo
                            </Button>
                            {onClearAnnotation && (
                              <Button
                                variant="ghost"
                                className="size-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  onClearAnnotation(item.fieldName)
                                }
                                aria-label="Clear annotation"
                                title="Remove marker"
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground"
                            onClick={() => onMarkLocation(item.fieldName)}
                          >
                            <Crosshair className="size-3.5" />
                            Mark Location
                          </Button>
                        )}
                      </>
                    )}
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

      {/* Matched fields — flaggable by specialist */}
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
            const correction = correctionsMap.get(item.fieldName)

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
              <div key={item.id} className="space-y-3">
                <div className="space-y-1.5">
                  <FieldComparisonRow
                    fieldName={item.fieldName}
                    expectedValue={item.expectedValue}
                    extractedValue={
                      item.status === 'not_found' ? null : item.extractedValue
                    }
                    status={
                      isFlagged
                        ? (override?.resolvedStatus ?? item.status)
                        : item.status
                    }
                    confidence={Number(item.confidence)}
                    reasoning={item.matchReasoning}
                    isActive={activeField === item.fieldName}
                    onClick={() => onFieldClick(item.fieldName)}
                    headerAction={flagAction}
                  />
                  {correction && (
                    <ApplicantCorrectionBadge correction={correction} />
                  )}
                </div>

                {/* Override controls for flagged matched fields */}
                {isFlagged && (
                  <div className="mt-1 ml-1 space-y-2.5 bg-amber-50/50 pl-4 dark:bg-amber-950/20">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {RESOLVE_OPTIONS.filter((o) => o.status !== 'match').map(
                        (option) => {
                          const isSelected =
                            override?.resolvedStatus === option.status

                          return (
                            <Button
                              key={option.status}
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-8 gap-1.5 text-xs',
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
                        },
                      )}

                      {/* Mark Location on Image — inline */}
                      {onMarkLocation && (
                        <>
                          <div className="mx-1 h-5 w-px bg-border" />
                          {annotations?.[item.fieldName] ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 border-indigo-200 text-xs text-indigo-700 dark:border-indigo-800 dark:text-indigo-400"
                                onClick={() => onMarkLocation(item.fieldName)}
                              >
                                <MapPin className="size-3.5" />
                                Redo
                              </Button>
                              {onClearAnnotation && (
                                <Button
                                  variant="ghost"
                                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    onClearAnnotation(item.fieldName)
                                  }
                                  aria-label="Clear annotation"
                                  title="Remove marker"
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs text-muted-foreground"
                              onClick={() => onMarkLocation(item.fieldName)}
                            >
                              <Crosshair className="size-3.5" />
                              Mark Location
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    <Textarea
                      placeholder="Why is this AI match incorrect?"
                      value={override?.reviewerNotes ?? ''}
                      onChange={(e) =>
                        handleOverrideNotes(item.id, e.target.value)
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
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
                  (+{matchOverrideCount} AI correction
                  {matchOverrideCount !== 1 ? 's' : ''})
                </span>
              )}
            </>
          )}
        </Button>
        {!allFlaggedResolved ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Resolve all {flaggedItems.length} flagged field
            {flaggedItems.length !== 1 ? 's' : ''} to enable submission.
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
