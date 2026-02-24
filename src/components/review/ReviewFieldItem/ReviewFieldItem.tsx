import { Crosshair, MapPin, X } from 'lucide-react'

import {
  ApplicantCorrectionBadge,
  type ApplicantCorrection,
} from '@/components/shared/ApplicantCorrectionBadge'
import { FieldComparisonRow } from '@/components/shared/FieldComparisonRow'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolveOption {
  status: string
  label: string
  icon: React.ReactNode
  className: string
  activeClassName: string
}

interface ReviewFieldItemProps {
  variant: 'flagged' | 'matched'
  itemId: string
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: string
  confidence: string
  matchReasoning: string | null
  /** The display status passed to FieldComparisonRow (may incorporate override) */
  displayStatus: string
  isActive: boolean
  correction: ApplicantCorrection | undefined
  resolvedStatus: string | undefined
  reviewerNotes: string
  resolveOptions: ResolveOption[]
  /** Whether to show the override controls section */
  showOverrides: boolean
  annotations?: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >
  /** Optional action element rendered in the FieldComparisonRow header (e.g. flag icon) */
  headerAction?: React.ReactNode
  onFieldClick: () => void
  onOverrideStatus: (status: string) => void
  onOverrideNotes: (notes: string) => void
  onMarkLocation?: (fieldName: string) => void
  onClearAnnotation?: (fieldName: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewFieldItem({
  variant,
  itemId,
  fieldName,
  expectedValue,
  extractedValue,
  status,
  confidence,
  matchReasoning,
  displayStatus,
  isActive,
  correction,
  resolvedStatus,
  reviewerNotes,
  resolveOptions,
  showOverrides,
  annotations,
  headerAction,
  onFieldClick,
  onOverrideStatus,
  onOverrideNotes,
  onMarkLocation,
  onClearAnnotation,
}: ReviewFieldItemProps) {
  const showTextarea =
    variant === 'flagged' ? resolvedStatus !== undefined : true

  const textareaPlaceholder =
    variant === 'flagged'
      ? 'Optional reviewer notes...'
      : 'Why is this AI match incorrect?'

  const controlsClassName =
    variant === 'flagged'
      ? 'mt-1 ml-1 space-y-2.5 border-l-2 border-muted pl-4'
      : 'mt-1 ml-1 space-y-2.5 bg-amber-50/50 pl-4 dark:bg-amber-950/20'

  return (
    <div key={itemId} className="space-y-3">
      <div className="space-y-1.5">
        <FieldComparisonRow
          fieldName={fieldName}
          expectedValue={expectedValue}
          extractedValue={status === 'not_found' ? null : extractedValue}
          status={displayStatus}
          confidence={Number(confidence)}
          reasoning={matchReasoning}
          isActive={isActive}
          onClick={onFieldClick}
          headerAction={headerAction}
        />
        {correction && <ApplicantCorrectionBadge correction={correction} />}
      </div>

      {/* Override controls */}
      {showOverrides && (
        <div className={controlsClassName}>
          <div className="flex flex-wrap items-center gap-1.5">
            {resolveOptions.map((option) => {
              const isSelected = resolvedStatus === option.status

              return (
                <Button
                  key={option.status}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 text-xs',
                    isSelected ? option.activeClassName : option.className,
                  )}
                  onClick={() => onOverrideStatus(option.status)}
                >
                  {option.icon}
                  {option.label}
                </Button>
              )
            })}

            {/* Mark Location on Image */}
            {onMarkLocation && (
              <>
                <div className="mx-1 h-5 w-px bg-border" />
                {annotations?.[fieldName] ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-indigo-200 text-xs text-indigo-700 dark:border-indigo-800 dark:text-indigo-400"
                      onClick={() => onMarkLocation(fieldName)}
                    >
                      <MapPin className="size-3.5" />
                      Redo
                    </Button>
                    {onClearAnnotation && (
                      <Button
                        variant="ghost"
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onClearAnnotation(fieldName)}
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
                    onClick={() => onMarkLocation(fieldName)}
                  >
                    <Crosshair className="size-3.5" />
                    Mark Location
                  </Button>
                )}
              </>
            )}
          </div>

          {showTextarea && (
            <Textarea
              placeholder={textareaPlaceholder}
              value={reviewerNotes}
              onChange={(e) => onOverrideNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          )}
        </div>
      )}
    </div>
  )
}
