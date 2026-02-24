'use client'

import { useCallback, useState } from 'react'

import {
  AnnotatedImage,
  type SpecialistAnnotation,
  type ValidationItemBox,
} from '@/components/validation/annotated-image'
import { ImageTabs } from '@/components/validation/image-tabs'
import { ReviewFieldList } from '@/components/review/review-field-list'

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

interface ApplicantCorrection {
  fieldName: string
  aiExtractedValue: string
  applicantSubmittedValue: string
}

interface ReviewDetailPanelsProps {
  labelId: string
  images: LabelImageData[]
  validationItems: ValidationItemData[]
  applicantCorrections?: ApplicantCorrection[]
  beverageType: string
}

export function ReviewDetailPanels({
  labelId,
  images,
  validationItems,
  applicantCorrections,
  beverageType,
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
    bboxAngle:
      item.labelImageId === selectedImageId && item.bboxAngle
        ? Number(item.bboxAngle)
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
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[55%_1fr]">
      {/* Left column — sticky image + tabs (stacks on mobile) */}
      <div className="flex h-[60vh] flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <ImageTabs
          images={images}
          selectedImageId={selectedImageId}
          onSelect={(id) => {
            setSelectedImageId(id)
            setActiveField(null)
          }}
        />
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-neutral-950/[0.03] dark:bg-neutral-950/30">
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

      {/* Right column — review field list, scrolls with page */}
      <div className="pb-6">
        <ReviewFieldList
          labelId={labelId}
          validationItems={validationItems}
          applicantCorrections={applicantCorrections}
          activeField={activeField}
          onFieldClick={handleFieldClick}
          onMarkLocation={handleMarkLocation}
          onClearAnnotation={handleClearAnnotation}
          annotations={annotationsMap}
          beverageType={beverageType}
        />
      </div>
    </div>
  )
}
