'use client'

import { useState, useCallback } from 'react'

import {
  AnnotatedImage,
  type ValidationItemBox,
} from '@/components/validation/annotated-image'
import { ImageTabs } from '@/components/validation/image-tabs'
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
  bboxAngle: string | null
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
  /** When true, hides confidence overlays on image and passes hideInternals to field rows */
  hideInternals?: boolean
}

export function ValidationDetailPanels({
  images,
  validationItems,
  hideInternals = false,
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
    confidence: hideInternals ? 0 : Number(item.confidence),
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
    bboxAngle:
      item.labelImageId === selectedImageId && item.bboxAngle
        ? Number(item.bboxAngle)
        : null,
    labelImageId: item.labelImageId,
  }))

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 310px)' }}>
      <ImageTabs
        images={images}
        selectedImageId={selectedImageId}
        onSelect={(id) => {
          setSelectedImageId(id)
          setActiveField(null)
        }}
      />

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left panel — annotated image (55%) */}
        <div className="flex w-[55%] shrink-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            {selectedImage && (
              <AnnotatedImage
                imageUrl={selectedImage.imageUrl}
                validationItems={annotationItems}
                activeField={activeField}
                onFieldClick={handleFieldClick}
                images={images}
                selectedImageId={selectedImageId}
                onImageSelect={(id) => {
                  setSelectedImageId(id)
                  setActiveField(null)
                }}
              />
            )}
          </div>
        </div>

        {/* Right panel — field comparisons (45%) */}
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-4 pb-1 pl-1">
            <h2 className="font-heading text-base font-semibold text-muted-foreground">
              Matched Fields
              <span className="ml-1.5 text-sm font-normal text-muted-foreground/50 tabular-nums">
                ({validationItems.length})
              </span>
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
                hideInternals={hideInternals}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
