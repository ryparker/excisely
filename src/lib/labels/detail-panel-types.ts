import type { ValidationItemStatus } from '@/lib/labels/validation-helpers'

/** Image data used by all detail panel variants. */
export interface LabelImageData {
  id: string
  imageUrl: string
  imageType: string
  sortOrder: number
}

/** Validation item data used by validation and review detail panels. */
export interface ValidationItemData {
  id: string
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: ValidationItemStatus
  confidence: string
  matchReasoning: string | null
  bboxX: string | null
  bboxY: string | null
  bboxWidth: string | null
  bboxHeight: string | null
  bboxAngle: string | null
  labelImageId: string | null
}
