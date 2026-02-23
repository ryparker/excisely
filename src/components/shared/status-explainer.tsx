'use client'

import { StatusBadge } from '@/components/shared/status-badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

type Role = 'specialist' | 'applicant'

const SPECIALIST_DESCRIPTIONS: Record<string, string> = {
  pending:
    'Received and queued for processing. The AI pipeline will start shortly.',
  processing:
    'AI analysis is running — OCR extraction and field classification typically takes 6–9 seconds.',
  pending_review:
    'AI analysis is complete. Review the field comparisons, then approve, flag corrections, or reject.',
  approved:
    'This label has been approved. No further action needed unless a re-analysis is requested.',
  conditionally_approved:
    'Approved with conditions. The applicant has a 7-day window to submit corrections for flagged fields.',
  needs_correction:
    'Issues were identified that require applicant corrections. A 30-day correction window has been set.',
  rejected:
    'This label application has been rejected. The applicant has been notified with the reasons.',
}

const APPLICANT_DESCRIPTIONS: Record<string, string> = {
  pending: 'Your submission has been received and will be analyzed shortly.',
  processing:
    "We're analyzing your label images right now. This page will update automatically when complete.",
  pending_review:
    "Your submission is being reviewed by a TTB labeling specialist. You'll be notified when a decision is made.",
  approved:
    'Your label has been approved. You may proceed with printing and distribution.',
  conditionally_approved:
    'Your label is approved with minor conditions. Please review the flagged items and resubmit corrections within 7 days.',
  needs_correction:
    'Some fields on your label need corrections. Please review the flagged items and resubmit within 30 days.',
  rejected:
    'Your label application was not approved. Please review the notes below and consider submitting a revised application.',
}

interface StatusExplainerProps {
  status: string
  role: Role
  className?: string
}

export function StatusExplainer({
  status,
  role,
  className,
}: StatusExplainerProps) {
  const descriptions =
    role === 'specialist' ? SPECIALIST_DESCRIPTIONS : APPLICANT_DESCRIPTIONS
  const description = descriptions[status]

  if (!description) {
    return <StatusBadge status={status} className={className} />
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="cursor-help">
          <StatusBadge status={status} className={className} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" className="w-72">
        <p className="text-sm leading-relaxed text-popover-foreground">
          {description}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
