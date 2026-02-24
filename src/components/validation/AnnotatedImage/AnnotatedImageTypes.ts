export interface ValidationItemBox {
  fieldName: string
  status: string
  extractedValue: string | null
  confidence: number
  bboxX: number | null
  bboxY: number | null
  bboxWidth: number | null
  bboxHeight: number | null
  bboxAngle: number | null
  labelImageId?: string | null
}

export interface SpecialistAnnotation {
  fieldName: string
  x: number
  y: number
  width: number
  height: number
}
