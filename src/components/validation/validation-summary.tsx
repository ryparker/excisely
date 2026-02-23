import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SearchX,
  Clock,
  Cpu,
  Bot,
} from 'lucide-react'

import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

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
}

function formatConfidence(value: number | null): string {
  if (value === null) return '--'
  return `${Math.round(value)}%`
}

function formatProcessingTime(ms: number | null): string {
  if (ms === null) return '--'
  return `${(ms / 1000).toFixed(1)}s`
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
}: ValidationSummaryProps) {
  const totalFields =
    fieldCounts.match +
    fieldCounts.mismatch +
    fieldCounts.notFound +
    fieldCounts.needsCorrection

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} className="px-3 py-1 text-sm" />
          {aiProposedStatus && status === 'pending_review' && (
            <Badge
              variant="outline"
              className="gap-1 border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400"
            >
              <Bot className="size-3" />
              AI Recommended:{' '}
              {AI_STATUS_LABELS[aiProposedStatus] ?? aiProposedStatus}
            </Badge>
          )}
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {formatConfidence(confidence)} confidence
          </span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-4 text-sm tabular-nums">
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-4" />
            {fieldCounts.match} match
          </span>
          {fieldCounts.mismatch > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <XCircle className="size-4" />
              {fieldCounts.mismatch} mismatch
            </span>
          )}
          {fieldCounts.needsCorrection > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              {fieldCounts.needsCorrection} needs correction
            </span>
          )}
          {fieldCounts.notFound > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <SearchX className="size-4" />
              {fieldCounts.notFound} not found
            </span>
          )}
          <span className="text-muted-foreground">
            ({totalFields} fields total)
          </span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            {formatProcessingTime(processingTimeMs)}
          </span>
          {modelUsed && (
            <span className="flex items-center gap-1.5">
              <Cpu className="size-4" />
              {modelUsed}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
