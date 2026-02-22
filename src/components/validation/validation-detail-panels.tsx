'use client'

import { useState } from 'react'

import { AnnotatedImage } from '@/components/validation/annotated-image'
import { FieldComparisonRow } from '@/components/shared/field-comparison-row'
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

interface ValidationDetailPanelsProps {
  imageUrl: string
  validationItems: ValidationItemData[]
}

export function ValidationDetailPanels({
  imageUrl,
  validationItems,
}: ValidationDetailPanelsProps) {
  const [activeField, setActiveField] = useState<string | null>(null)

  const handleFieldClick = (fieldName: string) => {
    setActiveField((prev) => (prev === fieldName ? null : fieldName))
  }

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

      {/* Right panel — field comparisons (45%) */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          <h2 className="font-heading text-lg font-semibold">
            Field Comparison
          </h2>
          {validationItems.map((item) => (
            <FieldComparisonRow
              key={item.id}
              fieldName={item.fieldName}
              expectedValue={item.expectedValue}
              extractedValue={
                item.status === 'not_found' ? null : item.extractedValue
              }
              status={item.status}
              confidence={Number(item.confidence)}
              reasoning={item.matchReasoning}
              isActive={activeField === item.fieldName}
              onClick={() => handleFieldClick(item.fieldName)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
