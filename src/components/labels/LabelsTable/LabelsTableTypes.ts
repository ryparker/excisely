export interface LabelRow {
  id: string
  status: string
  effectiveStatus: string
  beverageType: string
  overallConfidence: string | null
  correctionDeadline: Date | null
  deadlineExpired: boolean
  isPriority: boolean
  createdAt: Date
  brandName: string | null
  flaggedCount: number
  thumbnailUrl: string | null
  overrideReasonCode?: string | null
  lastReviewedAt?: Date | null
}

export interface LabelsTableProps {
  labels: LabelRow[]
  userRole: string
  totalPages: number
  tableTotal: number
  pageSize: number
  queueMode?: 'ready' | 'review'
  searchTerm?: string
}

export type BulkItemStatus = 'pending' | 'processing' | 'success' | 'error'

export const NON_REANALYZABLE_STATUSES = new Set(['pending', 'processing'])
