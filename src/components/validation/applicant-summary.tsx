import { CheckCircle2, XCircle, AlertTriangle, SearchX } from 'lucide-react'

interface FieldCounts {
  match: number
  mismatch: number
  notFound: number
  needsCorrection: number
}

interface ApplicantSummaryProps {
  fieldCounts: FieldCounts
}

export function ApplicantSummary({ fieldCounts }: ApplicantSummaryProps) {
  const totalFields =
    fieldCounts.match +
    fieldCounts.mismatch +
    fieldCounts.notFound +
    fieldCounts.needsCorrection

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
          of {totalFields} fields verified
        </span>
      </div>
    </div>
  )
}
