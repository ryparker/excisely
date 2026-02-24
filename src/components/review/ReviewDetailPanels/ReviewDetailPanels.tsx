'use client'

import { useCallback, useState } from 'react'

import type { SpecialistAnnotation } from '@/components/validation/AnnotatedImage'
import { DetailPanelLayout } from '@/components/shared/DetailPanelLayout'
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
  const nav = useImageFieldNavigation({ images, validationItems })

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
    <DetailPanelLayout
      images={images}
      selectedImage={nav.selectedImage}
      selectedImageId={nav.selectedImageId}
      onImageSelect={nav.handleImageSelect}
      annotationItems={nav.annotationItems}
      activeField={nav.activeField}
      onFieldClick={nav.handleFieldClick}
      drawingFieldName={drawingFieldName}
      onDrawingComplete={handleDrawingComplete}
      onDrawingCancel={handleDrawingCancel}
      annotations={specialistAnnotations}
      imageContainerClassName="rounded-xl border bg-neutral-950/[0.03] dark:bg-neutral-950/30"
    >
      <div className="pb-6">
        <ReviewFieldList
          labelId={labelId}
          validationItems={validationItems}
          applicantCorrections={applicantCorrections}
          activeField={nav.activeField}
          onFieldClick={nav.handleFieldClick}
          onMarkLocation={handleMarkLocation}
          onClearAnnotation={handleClearAnnotation}
          annotations={annotationsMap}
          beverageType={beverageType}
        />
      </div>
    </DetailPanelLayout>
  )
}
