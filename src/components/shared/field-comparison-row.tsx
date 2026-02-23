'use client'

import { useEffect, useRef, useState } from 'react'
import { diffChars } from 'diff'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SearchX,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { FieldLabel } from '@/components/shared/field-label'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<string, React.ReactNode> = {
  match: <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />,
  mismatch: <XCircle className="size-4 text-red-600 dark:text-red-400" />,
  needs_correction: (
    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
  ),
  not_found: <SearchX className="size-4 text-muted-foreground" />,
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  match: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  mismatch: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  needs_correction:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  not_found: 'bg-secondary text-muted-foreground',
}

const STATUS_BORDER: Record<string, string> = {
  match: 'border-green-200 dark:border-green-900/40',
  mismatch: 'border-red-200 dark:border-red-900/40',
  needs_correction: 'border-amber-200 dark:border-amber-900/40',
  not_found: 'border-border',
}

const ACTIVE_BG: Record<string, string> = {
  match: 'bg-green-50/50 dark:bg-green-950/20',
  mismatch: 'bg-red-50/50 dark:bg-red-950/20',
  needs_correction: 'bg-amber-50/50 dark:bg-amber-950/20',
  not_found: 'bg-muted/50',
}

const ACTIVE_RING: Record<string, string> = {
  match: 'ring-green-500/50',
  mismatch: 'ring-red-500/50',
  needs_correction: 'ring-amber-500/50',
  not_found: 'ring-border',
}

interface FieldComparisonRowProps {
  fieldName: string
  expectedValue: string
  extractedValue: string | null
  status: string
  confidence: number
  reasoning: string | null
  isActive: boolean
  onClick: () => void
}

function DiffHighlight({
  expected,
  extracted,
}: {
  expected: string
  extracted: string
}) {
  const changes = diffChars(expected, extracted)

  return (
    <span>
      {changes.map((part, i) => {
        if (part.added) {
          return (
            <span
              key={i}
              className="rounded-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
            >
              {part.value}
            </span>
          )
        }
        if (part.removed) {
          return null
        }
        return (
          <span key={i} className="text-green-700 dark:text-green-300">
            {part.value}
          </span>
        )
      })}
    </span>
  )
}

export function FieldComparisonRow({
  fieldName,
  expectedValue,
  extractedValue,
  status,
  confidence,
  reasoning,
  isActive,
  onClick,
}: FieldComparisonRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  const displayName =
    FIELD_DISPLAY_NAMES[fieldName] ?? fieldName.replace(/_/g, ' ')
  const confidencePercent = Math.round(confidence)
  const borderStyle = STATUS_BORDER[status] ?? 'border-border'
  const badgeStyle = STATUS_BADGE_STYLE[status] ?? ''
  const activeBg = ACTIVE_BG[status] ?? ''
  const activeRing = ACTIVE_RING[status] ?? 'ring-primary'

  return (
    <div
      ref={rowRef}
      className={cn(
        'cursor-pointer rounded-lg border p-4 transition-all duration-200',
        borderStyle,
        isActive && cn('ring-2 ring-offset-2', activeRing, activeBg),
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Row header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {STATUS_ICON[status]}
          <FieldLabel fieldName={fieldName} className="text-sm font-medium">
            {displayName}
          </FieldLabel>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {confidencePercent}%
          </span>
          <Badge variant="secondary" className={cn('text-xs', badgeStyle)}>
            {status === 'needs_correction'
              ? 'Needs Correction'
              : status === 'not_found'
                ? 'Not Found'
                : status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Application
          </p>
          <p className="text-sm break-words">{expectedValue}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Label (AI)
          </p>
          {extractedValue === null ? (
            <p className="text-sm text-muted-foreground italic">Not found</p>
          ) : status === 'mismatch' || status === 'needs_correction' ? (
            <p className="text-sm break-words">
              <DiffHighlight
                expected={expectedValue}
                extracted={extractedValue}
              />
            </p>
          ) : (
            <p className="text-sm break-words">{extractedValue}</p>
          )}
        </div>
      </div>

      {/* Expandable reasoning */}
      {reasoning && (
        <div className="mt-3 border-t pt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            AI Reasoning
          </button>
          {expanded && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
