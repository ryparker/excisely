import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SearchX,
  Clock,
  Cpu,
  Bot,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatConfidence, formatProcessingTime } from '@/lib/utils'

interface FieldCounts {
  match: number
  mismatch: number
  notFound: number
  needsCorrection: number
}

interface ValidationSummaryProps {
  status: string
  confidence: number | null
  processingTimeMs: number | null
  modelUsed: string | null
  fieldCounts: FieldCounts
  aiProposedStatus?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
}

const AI_STATUS_LABELS: Record<string, string> = {
  rejected: 'Rejected',
  needs_correction: 'Needs Correction',
  conditionally_approved: 'Conditionally Approved',
}

export function ValidationSummary({
  status,
  confidence,
  processingTimeMs,
  modelUsed,
  fieldCounts,
  aiProposedStatus,
  inputTokens,
  outputTokens,
  totalTokens,
}: ValidationSummaryProps) {
  const totalFields =
    fieldCounts.match +
    fieldCounts.mismatch +
    fieldCounts.notFound +
    fieldCounts.needsCorrection

  return (
    <div className="space-y-2.5">
      {/* Primary row: AI recommendation + field counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {aiProposedStatus && status === 'pending_review' && (
            <Badge
              variant="outline"
              className="gap-1.5 border-indigo-200 bg-indigo-50/50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400"
            >
              <Bot className="size-3.5" />
              AI Recommended:{' '}
              {AI_STATUS_LABELS[aiProposedStatus] ?? aiProposedStatus}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatConfidence(confidence)} confidence
          </span>
        </div>

        {/* Field counts — right-aligned */}
        <div className="flex items-center gap-2 text-sm tabular-nums">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-green-700 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />
            {fieldCounts.match}
          </span>
          {fieldCounts.mismatch > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <XCircle className="size-3.5" />
              {fieldCounts.mismatch}
            </span>
          )}
          {fieldCounts.needsCorrection > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              {fieldCounts.needsCorrection}
            </span>
          )}
          {fieldCounts.notFound > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
              <SearchX className="size-3.5" />
              {fieldCounts.notFound}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            of {totalFields} fields
          </span>
        </div>
      </div>

      {/* Secondary row: Processing metadata */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {formatProcessingTime(processingTimeMs)}
        </span>
        {modelUsed && (
          <span className="inline-flex items-center gap-1">
            <Cpu className="size-3" />
            {modelUsed}
          </span>
        )}
        {totalTokens != null && (
          <span className="inline-flex items-center gap-1">
            <Zap className="size-3" />
            {totalTokens.toLocaleString()} tokens
            {inputTokens != null && outputTokens != null && (
              <span className="text-muted-foreground/40">
                ({inputTokens.toLocaleString()} in /{' '}
                {outputTokens.toLocaleString()} out)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
