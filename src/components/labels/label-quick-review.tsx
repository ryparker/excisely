'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ExternalLink, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import {
  getLabelFieldSummary,
  type FieldSummary,
} from '@/app/actions/get-label-field-summary'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabelQuickReviewProps {
  labelId: string
  brandName: string | null
  thumbnailUrl: string | null
  overallConfidence: string | null
  onApprove?: (labelId: string) => void
  isApproving?: boolean
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

const FIELD_STATUS_COLORS: Record<string, string> = {
  match: 'text-green-600 dark:text-green-400',
  mismatch: 'text-red-600 dark:text-red-400',
  needs_correction: 'text-amber-600 dark:text-amber-400',
  not_found: 'text-muted-foreground',
}

const NEAR_MISS_THRESHOLD = 95

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelQuickReview({
  labelId,
  brandName,
  thumbnailUrl,
  overallConfidence,
  onApprove,
  isApproving,
}: LabelQuickReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [fields, setFields] = useState<FieldSummary[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleToggle = useCallback(() => {
    if (!isExpanded && !fields) {
      // Lazy-load field data on first expand
      startTransition(async () => {
        setError(null)
        const result = await getLabelFieldSummary(labelId)
        if (result.success && result.fields) {
          setFields(result.fields)
        } else {
          setError(result.error ?? 'Failed to load fields')
        }
      })
    }
    setIsExpanded((prev) => !prev)
  }, [isExpanded, fields, labelId])

  return (
    <div className="border-t">
      {/* Toggle bar */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
        onClick={handleToggle}
      >
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
        Quick Review
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              {/* Loading state */}
              {isPending && !fields && (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading field summary...
                </div>
              )}

              {/* Error state */}
              {error && (
                <p className="py-2 text-sm text-destructive">{error}</p>
              )}

              {/* Field grid */}
              {fields && (
                <>
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    {thumbnailUrl && (
                      <div className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbnailUrl}
                          alt={brandName ?? 'Label'}
                          className="size-28 rounded-lg border object-cover"
                        />
                      </div>
                    )}

                    {/* Fields */}
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {fields.map((field) => {
                          const isNearMiss =
                            field.status === 'match' &&
                            field.confidence < NEAR_MISS_THRESHOLD
                          const displayName =
                            FIELD_DISPLAY_NAMES[field.fieldName] ??
                            field.fieldName.replace(/_/g, ' ')

                          return (
                            <div
                              key={field.fieldName}
                              className="flex items-baseline justify-between gap-2 text-xs"
                            >
                              <span className="truncate font-medium text-muted-foreground">
                                {displayName}
                              </span>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span
                                  className={cn(
                                    'max-w-[180px] truncate',
                                    FIELD_STATUS_COLORS[field.status],
                                  )}
                                >
                                  {field.extractedValue || '—'}
                                </span>
                                {isNearMiss && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 border-amber-300 px-1 text-[9px] text-amber-600 dark:border-amber-700 dark:text-amber-400"
                                  >
                                    {Math.round(field.confidence)}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-xs text-muted-foreground">
                      Confidence:{' '}
                      <span className="font-mono font-medium">
                        {overallConfidence
                          ? `${Math.round(Number(overallConfidence))}%`
                          : '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        asChild
                      >
                        <Link href={`/labels/${labelId}`}>
                          Full Review
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                      {onApprove && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onApprove(labelId)}
                          disabled={isApproving}
                        >
                          {isApproving ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="size-3" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
