'use client'

import { useState, useCallback } from 'react'

import {
  AnnotatedImage,
  type ValidationItemBox,
} from '@/components/validation/annotated-image'
import { FieldComparisonRow } from '@/components/shared/field-comparison-row'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

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
  labelImageId: string | null
}

interface LabelImageData {
  id: string
  imageUrl: string
  imageType: string
  sortOrder: number
}

interface ValidationDetailPanelsProps {
  images: LabelImageData[]
  validationItems: ValidationItemData[]
}

const IMAGE_TYPE_LABELS: Record<string, string> = {
  front: 'Front',
  back: 'Back',
  neck: 'Neck',
  strip: 'Strip',
  other: 'Other',
}

export function ValidationDetailPanels({
  images,
  validationItems,
}: ValidationDetailPanelsProps) {
  const [activeField, setActiveField] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string>(
    images[0]?.id ?? '',
  )

  const selectedImage = images.find((img) => img.id === selectedImageId)

  const handleFieldClick = useCallback(
    (fieldName: string) => {
      setActiveField((prev) => {
        const next = prev === fieldName ? null : fieldName
        // Auto-switch to the image this field belongs to
        if (next) {
          const item = validationItems.find((v) => v.fieldName === next)
          if (item?.labelImageId && item.labelImageId !== selectedImageId) {
            setSelectedImageId(item.labelImageId)
          }
        }
        return next
      })
    },
    [validationItems, selectedImageId],
  )

  // Only show bounding boxes for items belonging to the selected image
  const annotationItems: ValidationItemBox[] = validationItems.map((item) => ({
    fieldName: item.fieldName,
    status: item.status,
    extractedValue: item.status === 'not_found' ? null : item.extractedValue,
    confidence: Number(item.confidence),
    bboxX:
      item.labelImageId === selectedImageId && item.bboxX
        ? Number(item.bboxX)
        : null,
    bboxY:
      item.labelImageId === selectedImageId && item.bboxY
        ? Number(item.bboxY)
        : null,
    bboxWidth:
      item.labelImageId === selectedImageId && item.bboxWidth
        ? Number(item.bboxWidth)
        : null,
    bboxHeight:
      item.labelImageId === selectedImageId && item.bboxHeight
        ? Number(item.bboxHeight)
        : null,
    labelImageId: item.labelImageId,
  }))

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 340px)' }}>
      {/* Left panel — annotated image (55%) */}
      <div className="flex w-[55%] shrink-0 flex-col overflow-hidden">
        {/* Image tabs (only show when multiple images) */}
        {images.length > 1 && (
          <div className="mb-2 flex gap-1">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  img.id === selectedImageId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                onClick={() => {
                  setSelectedImageId(img.id)
                  setActiveField(null)
                }}
              >
                {IMAGE_TYPE_LABELS[img.imageType] ??
                  `Image ${img.sortOrder + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {selectedImage && (
            <AnnotatedImage
              imageUrl={selectedImage.imageUrl}
              validationItems={annotationItems}
              activeField={activeField}
              onFieldClick={handleFieldClick}
            />
          )}
        </div>
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
