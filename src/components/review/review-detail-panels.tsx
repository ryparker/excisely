'use client'

import { useState } from 'react'

import { AnnotatedImage } from '@/components/validation/annotated-image'
import { ReviewFieldList } from '@/components/review/review-field-list'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ValidationItemData {
  id: string
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: string
  confidence: string
  matchReasoning: string | null
  bboxX: string | null
  bboxY: string | null
  bboxWidth: string | null
  bboxHeight: string | null
}

interface ReviewDetailPanelsProps {
  labelId: string
  imageUrl: string
  validationItems: ValidationItemData[]
}

export function ReviewDetailPanels({
  labelId,
  imageUrl,
  validationItems,
}: ReviewDetailPanelsProps) {
  const [activeField, setActiveField] = useState<string | null>(null)

  const annotationItems = validationItems.map((item) => ({
    fieldName: item.fieldName,
    status: item.status,
    bboxX: item.bboxX ? Number(item.bboxX) : null,
    bboxY: item.bboxY ? Number(item.bboxY) : null,
    bboxWidth: item.bboxWidth ? Number(item.bboxWidth) : null,
    bboxHeight: item.bboxHeight ? Number(item.bboxHeight) : null,
  }))

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 340px)' }}>
      {/* Left panel — annotated image (55%) */}
      <div className="w-[55%] shrink-0">
        <AnnotatedImage
          imageUrl={imageUrl}
          validationItems={annotationItems}
          activeField={activeField}
        />
      </div>

      {/* Right panel — review field list (45%) */}
      <ScrollArea className="flex-1">
        <div className="pr-4">
          <ReviewFieldList
            labelId={labelId}
            validationItems={validationItems}
            activeField={activeField}
            onFieldClick={(fieldName) =>
              setActiveField((prev) => (prev === fieldName ? null : fieldName))
            }
          />
        </div>
      </ScrollArea>
    </div>
  )
}
