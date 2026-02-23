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
import { RegulationInlineLink } from '@/components/shared/regulation-quick-view'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import { getSection } from '@/lib/regulations/lookup'
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
  /** When true, hides confidence %, AI reasoning, and changes "Label (AI)" → "Label" */
  hideInternals?: boolean
  /** Optional action element rendered inline in the header row (e.g. flag icon) */
  headerAction?: React.ReactNode
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
            <mark
              key={i}
              className="rounded-sm bg-red-100/80 px-0.5 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            >
              {part.value}
            </mark>
          )
        }
        if (part.removed) {
          return null
        }
        return <span key={i}>{part.value}</span>
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
  hideInternals = false,
  headerAction,
}: FieldComparisonRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        'cursor-pointer rounded-lg border p-3 transition-shadow duration-150',
        borderStyle,
        isActive && cn('ring-2 ring-offset-2', activeRing, activeBg),
        !isActive && 'hover:shadow-sm',
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {STATUS_ICON[status]}
          <FieldLabel fieldName={fieldName} className="text-sm font-semibold">
            {displayName}
          </FieldLabel>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
          {!hideInternals && (
            <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
              {confidencePercent}%
            </span>
          )}
          <Badge variant="secondary" className={cn('text-[11px]', badgeStyle)}>
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
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
            Application
          </p>
          <p className="text-[13px] leading-relaxed break-words">
            {expectedValue}
          </p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
            {hideInternals ? 'Label' : 'Label (AI)'}
          </p>
          {extractedValue === null ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground italic">
              Not found
            </p>
          ) : status === 'mismatch' || status === 'needs_correction' ? (
            <p className="text-[13px] leading-relaxed break-words">
              <DiffHighlight
                expected={expectedValue}
                extracted={extractedValue}
              />
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed break-words">
              {extractedValue}
            </p>
          )}
        </div>
      </div>

      {/* Expandable reasoning (hidden for applicants) */}
      {reasoning && !hideInternals && (
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

      {/* Contextual regulation link for flagged fields */}
      {(status === 'mismatch' || status === 'needs_correction') &&
        (() => {
          const cfr = FIELD_TOOLTIPS[fieldName]?.cfr
          if (!cfr || cfr.length === 0) return null
          const firstSection = getSection(cfr[0])
          if (!firstSection) return null
          return (
            <div className="mt-2 border-t pt-2">
              <RegulationInlineLink
                citation={firstSection.citation}
                title={firstSection.title}
                summary={firstSection.summary}
                keyRequirements={firstSection.keyRequirements}
                relatedFields={firstSection.relatedFields}
                ecfrUrl={firstSection.ecfrUrl}
                contextPart={firstSection.part}
                contextField={fieldName}
              />
            </div>
          )
        })()}
    </div>
  )
}
