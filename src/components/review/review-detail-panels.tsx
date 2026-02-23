'use client'

import { useCallback, useState } from 'react'

import {
  AnnotatedImage,
  type SpecialistAnnotation,
  type ValidationItemBox,
} from '@/components/validation/annotated-image'
import { ReviewFieldList } from '@/components/review/review-field-list'
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

interface ReviewDetailPanelsProps {
  labelId: string
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

export function ReviewDetailPanels({
  labelId,
  images,
  validationItems,
}: ReviewDetailPanelsProps) {
  const [activeField, setActiveField] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string>(
    images[0]?.id ?? '',
  )
  const [drawingFieldName, setDrawingFieldName] = useState<string | null>(null)
  const [annotationsMap, setAnnotationsMap] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({})

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

  const handleMarkLocation = useCallback((fieldName: string) => {
    // If the same field is already in drawing mode, reset it so the user
    // can start a fresh draw (e.g. after placing a pending rect).
    setDrawingFieldName((prev) => {
      if (prev === fieldName) {
        // Force a state change by going to null first, then back.
        // Use setTimeout so React sees two distinct state updates.
        setTimeout(() => setDrawingFieldName(fieldName), 0)
        return null
      }
      return fieldName
    })
  }, [])

  const handleDrawingComplete = useCallback(
    (
      fieldName: string,
      bbox: { x: number; y: number; width: number; height: number },
    ) => {
      setAnnotationsMap((prev) => ({ ...prev, [fieldName]: bbox }))
      setDrawingFieldName(null)
    },
    [],
  )

  const handleDrawingCancel = useCallback(() => {
    setDrawingFieldName(null)
  }, [])

  const handleClearAnnotation = useCallback((fieldName: string) => {
    setAnnotationsMap((prev) => {
      const next = { ...prev }
      delete next[fieldName]
      return next
    })
    // Cancel drawing if active for this field
    setDrawingFieldName((prev) => (prev === fieldName ? null : prev))
  }, [])

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

  const specialistAnnotations: SpecialistAnnotation[] = Object.entries(
    annotationsMap,
  ).map(([fieldName, bbox]) => ({
    fieldName,
    ...bbox,
  }))

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 340px)' }}>
      {/* Left panel — annotated image (55%) */}
      <div className="flex w-[55%] shrink-0 flex-col">
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
              drawingFieldName={drawingFieldName}
              onDrawingComplete={handleDrawingComplete}
              onDrawingCancel={handleDrawingCancel}
              annotations={specialistAnnotations}
            />
          )}
        </div>
      </div>

      {/* Right panel — review field list (45%) */}
      <ScrollArea className="flex-1">
        <div className="pr-4">
          <ReviewFieldList
            labelId={labelId}
            validationItems={validationItems}
            activeField={activeField}
            onFieldClick={handleFieldClick}
            onMarkLocation={handleMarkLocation}
            onClearAnnotation={handleClearAnnotation}
            annotations={annotationsMap}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
