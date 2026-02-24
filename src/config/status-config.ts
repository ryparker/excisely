interface StatusEntry {
  label: string
  /** Badge/chip classes: border + bg + text for light & dark modes. */
  className: string
  /** Icon circle classes: bg + text for timeline/step icon backgrounds. */
  iconClassName: string
  /** Pulse ring class: single bg color for the animated pulse ring. */
  pulseClassName: string
}

export const STATUS_CONFIG: Record<string, StatusEntry> = {
  approved: {
    label: 'Approved',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400',
    iconClassName:
      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400',
    pulseClassName: 'bg-emerald-400',
  },
  conditionally_approved: {
    label: 'Conditionally Approved',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400',
    iconClassName:
      'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
    pulseClassName: 'bg-amber-400',
  },
  needs_correction: {
    label: 'Needs Correction',
    className:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-400',
    iconClassName:
      'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    pulseClassName: 'bg-orange-400',
  },
  rejected: {
    label: 'Rejected',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400',
    iconClassName: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
    pulseClassName: 'bg-red-400',
  },
  pending_review: {
    label: 'Pending Review',
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400',
    iconClassName:
      'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400',
    pulseClassName: 'bg-indigo-400',
  },
  processing: {
    label: 'Processing',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
    iconClassName:
      'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    pulseClassName: 'bg-blue-400',
  },
  pending: {
    label: 'Pending',
    className: 'border-border bg-secondary text-secondary-foreground',
    iconClassName: 'bg-muted text-muted-foreground',
    pulseClassName: 'bg-muted-foreground',
  },
}

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending:
    'Received and queued. The AI pipeline will begin processing shortly.',
  processing:
    'AI analysis in progress — OCR extraction and field classification typically takes 6-9 seconds.',
  pending_review:
    'AI analysis complete. A labeling specialist will review the field comparisons and make a determination.',
  approved:
    'This label has been approved. No further action needed unless a re-analysis is requested.',
  conditionally_approved:
    'Approved with conditions. The applicant has a 7-day window to submit corrections for flagged fields.',
  needs_correction:
    'Issues identified that require applicant corrections. A 30-day correction window has been set.',
  rejected:
    'This label application has been rejected. The applicant has been notified with the reasons.',
}

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label]),
)
