'use client'

import { useMemo, useState } from 'react'
import { Flag } from 'lucide-react'

import type { ApplicantCorrection } from '@/components/shared/ApplicantCorrectionBadge'
import { ReviewFieldItem } from '@/components/review/ReviewFieldItem'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import { cn } from '@/lib/utils'
import { determineOverallStatus } from '@/lib/labels/validation-helpers'
import type { ValidationItemData } from '@/lib/labels/detail-panel-types'
import type { BeverageType } from '@/config/beverage-types'

import {
  FLAGGED_STATUSES,
  RESOLVE_OPTIONS,
  MATCHED_RESOLVE_OPTIONS,
} from './ReviewFieldConstants'
import { ReviewSubmitButton } from './ReviewSubmitButton'

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
  const correctionsMap = useMemo(() => {
    const map = new Map<string, ApplicantCorrection>()
    if (applicantCorrections) {
      for (const c of applicantCorrections) {
        map.set(c.fieldName, c)
      }
    }
    return map
  }, [applicantCorrections])

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

  const flaggedOverrides = flaggedItems
    .filter((item) => overrides[item.id]?.resolvedStatus !== undefined)
    .map((item) => ({
      validationItemId: item.id,
      originalStatus: item.status,
      resolvedStatus: overrides[item.id].resolvedStatus,
      reviewerNotes: overrides[item.id].reviewerNotes || undefined,
      annotationData: annotations?.[item.fieldName] ?? null,
    }))

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

  const unresolvedCount =
    flaggedItems.length -
    flaggedItems.filter(
      (item) => overrides[item.id]?.resolvedStatus !== undefined,
    ).length

  return (
    <div className="space-y-6">
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

      <ReviewSubmitButton
        labelId={labelId}
        overrideEntries={overrideEntries}
        allFlaggedResolved={allFlaggedResolved}
        projectedStatus={projectedStatus}
        flaggedCount={flaggedItems.length}
        unresolvedCount={unresolvedCount}
        matchOverrideCount={matchOverrideCount}
      />
    </div>
  )
}
