// ---------------------------------------------------------------------------
// Timeline event types — used by build-timeline.ts and UI components
// ---------------------------------------------------------------------------

export type TimelineEventType =
  | 'submitted'
  | 'processing_complete'
  | 'status_determined'
  | 'email_sent'
  | 'specialist_review'
  | 'status_override'
  | 'override_email_sent'
  | 'deadline_warning'

export interface TimelineEmail {
  from: string
  to: string
  subject: string
  body: string
  fieldIssues?: {
    displayName: string
    expected: string
    found: string
    status: string
  }[]
}

export interface TimelineEvent {
  /** Stable React key (e.g. "submitted-{labelId}") */
  id: string
  type: TimelineEventType
  timestamp: Date
  title: string
  description: string
  /** Label status for color-coding the icon */
  status?: string
  /** Specialist name for reviews/overrides */
  actorName?: string
  /** Expandable email content for email-type events */
  email?: TimelineEmail | null
  /** Extra info: notes, justification, etc. */
  metadata?: Record<string, string>
}
