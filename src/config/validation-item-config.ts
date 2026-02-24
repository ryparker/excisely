import { AlertTriangle, CheckCircle2, SearchX, XCircle } from 'lucide-react'
import { createElement } from 'react'

// ---------------------------------------------------------------------------
// Badge styles (shared by field-comparison-row, annotated-image, ai-errors-table)
// ---------------------------------------------------------------------------

export const VALIDATION_BADGE_STYLE: Record<string, string> = {
  match: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  mismatch: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  needs_correction:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  not_found: 'bg-secondary text-muted-foreground',
}

export const VALIDATION_BADGE_LABEL: Record<string, string> = {
  match: 'Match',
  mismatch: 'Mismatch',
  not_found: 'Not Found',
  needs_correction: 'Needs Correction',
}

// ---------------------------------------------------------------------------
// Border + background styles (field-comparison-row)
// ---------------------------------------------------------------------------

export const VALIDATION_BORDER: Record<string, string> = {
  match: 'border-green-200 dark:border-green-900/40',
  mismatch: 'border-red-200 dark:border-red-900/40',
  needs_correction: 'border-amber-200 dark:border-amber-900/40',
  not_found: 'border-border',
}

export const VALIDATION_RESTING_BG: Record<string, string> = {
  mismatch: 'bg-red-50/30 dark:bg-red-950/10',
  needs_correction: 'bg-amber-50/30 dark:bg-amber-950/10',
}

export const VALIDATION_ACTIVE_BG: Record<string, string> = {
  match: 'bg-green-50/50 dark:bg-green-950/20',
  mismatch: 'bg-red-50/50 dark:bg-red-950/20',
  needs_correction: 'bg-amber-50/50 dark:bg-amber-950/20',
  not_found: 'bg-muted/50',
}

export const VALIDATION_ACTIVE_RING: Record<string, string> = {
  match: 'ring-green-500/50',
  mismatch: 'ring-red-500/50',
  needs_correction: 'ring-amber-500/50',
  not_found: 'ring-border',
}

// ---------------------------------------------------------------------------
// Status icons (field-comparison-row)
// ---------------------------------------------------------------------------

export const VALIDATION_STATUS_ICON: Record<string, React.ReactNode> = {
  match: createElement(CheckCircle2, {
    className: 'size-4 text-green-600 dark:text-green-400',
  }),
  mismatch: createElement(XCircle, {
    className: 'size-4 text-red-600 dark:text-red-400',
  }),
  needs_correction: createElement(AlertTriangle, {
    className: 'size-4 text-amber-600 dark:text-amber-400',
  }),
  not_found: createElement(SearchX, {
    className: 'size-4 text-muted-foreground',
  }),
}

// ---------------------------------------------------------------------------
// Bounding box overlay colors (annotated-image)
// ---------------------------------------------------------------------------

export const VALIDATION_BOX_COLORS: Record<
  string,
  { border: string; bg: string; hoverBorder: string; hoverBg: string }
> = {
  match: {
    border: 'border-green-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-green-500',
    hoverBg: 'group-hover/box:bg-green-500/10',
  },
  mismatch: {
    border: 'border-red-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-red-500',
    hoverBg: 'group-hover/box:bg-red-500/10',
  },
  needs_correction: {
    border: 'border-amber-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-amber-500',
    hoverBg: 'group-hover/box:bg-amber-500/10',
  },
}

export const VALIDATION_BOX_ACTIVE_COLORS: Record<
  string,
  { border: string; bg: string; shadow: string }
> = {
  match: {
    border: 'border-green-500',
    bg: 'bg-green-500/20',
    shadow: '0 0 12px 2px rgba(34,197,94,0.5)',
  },
  mismatch: {
    border: 'border-red-500',
    bg: 'bg-red-500/20',
    shadow: '0 0 12px 2px rgba(239,68,68,0.5)',
  },
  needs_correction: {
    border: 'border-amber-500',
    bg: 'bg-amber-500/20',
    shadow: '0 0 12px 2px rgba(245,158,11,0.5)',
  },
}
