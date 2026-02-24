import { cn } from '@/lib/utils'

interface SaveFeedbackProps {
  isPending: boolean
  saved: boolean
  error: string | null
  className?: string
}

export function SaveFeedback({
  isPending,
  saved,
  error,
  className,
}: SaveFeedbackProps) {
  return (
    <div className={cn('flex h-5 items-center text-xs', className)}>
      {isPending && (
        <span className="animate-pulse text-muted-foreground">Saving...</span>
      )}
      {saved && (
        <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
      )}
      {error && <span className="text-destructive">{error}</span>}
    </div>
  )
}
