import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SearchX,
  Clock,
  Cpu,
} from 'lucide-react'

import { StatusBadge } from '@/components/shared/status-badge'
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
}

function formatConfidence(value: number | null): string {
  if (value === null) return '--'
  return `${Math.round(value * 100)}%`
}

function formatProcessingTime(ms: number | null): string {
  if (ms === null) return '--'
  return `${(ms / 1000).toFixed(1)}s`
}

export function ValidationSummary({
  status,
  confidence,
  processingTimeMs,
  modelUsed,
  fieldCounts,
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
          <span className="text-sm font-medium text-muted-foreground">
            {formatConfidence(confidence)} confidence
          </span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-4 text-sm">
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
