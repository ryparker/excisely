import { useCallback, useState } from 'react'

import type { ValidationItemBox } from '@/components/validation/AnnotatedImage'
import type {
  LabelImageData,
  ValidationItemData,
} from '@/lib/labels/detail-panel-types'

interface UseImageFieldNavigationOptions {
  images: LabelImageData[]
  validationItems: ValidationItemData[]
  /** Override confidence values (e.g. set to 0 to hide). Defaults to raw confidence. */
  confidenceOverride?: (item: ValidationItemData) => number
}

export function useImageFieldNavigation({
  images,
  validationItems,
  confidenceOverride,
}: UseImageFieldNavigationOptions) {
  const [activeField, setActiveField] = useState<string | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string>(
    images[0]?.id ?? '',
  )

  const selectedImage = images.find((img) => img.id === selectedImageId)

  const handleFieldClick = useCallback(
    (fieldName: string) => {
      setActiveField((prev) => {
        const next = prev === fieldName ? null : fieldName
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

  const handleImageSelect = useCallback((id: string) => {
    setSelectedImageId(id)
    setActiveField(null)
  }, [])

  const annotationItems: ValidationItemBox[] = validationItems.map((item) => ({
    fieldName: item.fieldName,
    status: item.status,
    extractedValue: item.status === 'not_found' ? null : item.extractedValue,
    confidence: confidenceOverride
      ? confidenceOverride(item)
      : Number(item.confidence),
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

  return {
    activeField,
    selectedImageId,
    selectedImage,
    handleFieldClick,
    handleImageSelect,
    annotationItems,
  }
}
