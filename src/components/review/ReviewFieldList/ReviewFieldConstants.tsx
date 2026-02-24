import { CheckCircle2, XCircle, SearchX } from 'lucide-react'

import type { ResolveOption } from '@/components/review/ReviewFieldItem'

export const FLAGGED_STATUSES = new Set([
  'needs_correction',
  'mismatch',
  'not_found',
])

export const RESOLVE_OPTIONS: ResolveOption[] = [
  {
    status: 'match',
    label: 'Confirm Match',
    icon: <CheckCircle2 className="size-4" />,
    className:
      'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950',
    activeClassName:
      'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300',
  },
  {
    status: 'mismatch',
    label: 'Mark Mismatch',
    icon: <XCircle className="size-4" />,
    className:
      'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950',
    activeClassName:
      'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300',
  },
  {
    status: 'not_found',
    label: 'Mark Not Found',
    icon: <SearchX className="size-4" />,
    className:
      'border-border text-muted-foreground hover:bg-muted dark:hover:bg-muted/50',
    activeClassName: 'bg-muted border-foreground/20 text-foreground',
  },
]

export const MATCHED_RESOLVE_OPTIONS = RESOLVE_OPTIONS.filter(
  (o) => o.status !== 'match',
)
