'use client'

import { useCallback, useState } from 'react'

import {
  AnnotatedImage,
  type SpecialistAnnotation,
} from '@/components/validation/AnnotatedImage'
import { ImageTabs } from '@/components/validation/ImageTabs'
import { ReviewFieldList } from '@/components/review/ReviewFieldList'
import { useImageFieldNavigation } from '@/hooks/useImageFieldNavigation'
import type { BeverageType } from '@/config/beverage-types'
import type {
  LabelImageData,
  ValidationItemData,
} from '@/lib/labels/detail-panel-types'

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
  beverageType: BeverageType
}

export function ReviewDetailPanels({
  labelId,
  images,
  validationItems,
  applicantCorrections,
  beverageType,
}: ReviewDetailPanelsProps) {
  const {
    activeField,
    selectedImage,
    selectedImageId,
    handleFieldClick,
    handleImageSelect,
    annotationItems,
  } = useImageFieldNavigation({ images, validationItems })

  // Drawing mode state (review-specific)
  const [drawingFieldName, setDrawingFieldName] = useState<string | null>(null)
  const [annotationsMap, setAnnotationsMap] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({})

  const handleMarkLocation = useCallback((fieldName: string) => {
    setDrawingFieldName((prev) => {
      if (prev === fieldName) {
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
    setDrawingFieldName((prev) => (prev === fieldName ? null : prev))
  }, [])

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
          onSelect={handleImageSelect}
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
              onImageSelect={handleImageSelect}
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
