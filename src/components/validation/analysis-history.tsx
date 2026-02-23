import { Clock, Cpu, Zap } from 'lucide-react'

interface AnalysisRun {
  id: string
  createdAt: Date
  modelUsed: string
  processingTimeMs: number
  totalTokens: number | null
}

interface AnalysisHistoryProps {
  runs: AnalysisRun[]
}

export function AnalysisHistory({ runs }: AnalysisHistoryProps) {
  if (runs.length === 0) return null

  return (
    <details className="group rounded-lg border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        Analysis History ({runs.length} previous{' '}
        {runs.length === 1 ? 'run' : 'runs'})
      </summary>
      <div className="divide-y border-t">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-muted-foreground"
          >
            <span>
              {run.createdAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="size-3" />
              {run.modelUsed}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {(run.processingTimeMs / 1000).toFixed(1)}s
            </span>
            {run.totalTokens !== null && (
              <span className="inline-flex items-center gap-1">
                <Zap className="size-3" />
                {run.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}
