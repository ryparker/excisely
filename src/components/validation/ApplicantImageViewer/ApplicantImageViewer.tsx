'use client'

import { useMemo, useState } from 'react'

import type { ApplicantExtractedField } from '@/app/actions/extract-fields-from-image'
import {
  AnnotatedImage,
  type ValidationItemBox,
} from '@/components/validation/AnnotatedImage'
import { ImageTabs } from '@/components/validation/ImageTabs'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { useExtractionStore } from '@/stores/useExtractionStore'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApplicantImageViewerProps {
  imageUrls: string[]
  fields: ApplicantExtractedField[]
  onFieldClick?: (fieldName: string) => void
  /** Local blob preview URLs (same order as imageUrls) shown while remote images load */
  placeholderUrls?: string[]
  /** When true, shows scan animation overlay on the placeholder */
  isScanning?: boolean
  /** Optional action element rendered to the right of the image tabs */
  action?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplicantImageViewer({
  imageUrls,
  fields,
  onFieldClick,
  placeholderUrls,
  isScanning = false,
  action,
}: ApplicantImageViewerProps) {
  const activeHighlightField = useExtractionStore((s) => s.activeHighlightField)

  // Track manual image selection along with the highlight field value at the
  // time of selection. When the highlight field changes (e.g. a bounding box is
  // clicked), the manual override is automatically invalidated without needing
  // an effect or ref — pure derivation.
  const [manualSelection, setManualSelection] = useState<{
    index: number
    whenField: string | null
  } | null>(null)

  const manualImageIndex =
    manualSelection && manualSelection.whenField === activeHighlightField
      ? manualSelection.index
      : null

  // Computed index: which image does the currently highlighted field live on?
  const computedImageIndex = useMemo(() => {
    if (!activeHighlightField) return 0
    const field = fields.find((f) => f.fieldName === activeHighlightField)
    return field?.imageIndex ?? 0
  }, [activeHighlightField, fields])

  const activeImageIndex = manualImageIndex ?? computedImageIndex

  const validationItems: ValidationItemBox[] = useMemo(
    () =>
      fields
        .filter((f) => f.imageIndex === activeImageIndex && f.boundingBox)
        .map((f) => ({
          fieldName: f.fieldName,
          status: 'neutral',
          extractedValue: f.value,
          confidence: 80,
          bboxX: f.boundingBox?.x ?? null,
          bboxY: f.boundingBox?.y ?? null,
          bboxWidth: f.boundingBox?.width ?? null,
          bboxHeight: f.boundingBox?.height ?? null,
          bboxAngle: null,
        })),
    [fields, activeImageIndex],
  )

  const imageUrl = imageUrls[activeImageIndex]
  if (!imageUrl) return null

  // Build image tab data from URLs — sign for the blob proxy so thumbnails load
  const tabImages = imageUrls.map((url, idx) => ({
    id: String(idx),
    imageUrl: getSignedImageUrl(url),
    imageType: idx === 0 ? 'front' : idx === 1 ? 'back' : 'other',
  }))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end gap-2">
        <ImageTabs
          images={tabImages}
          selectedImageId={String(activeImageIndex)}
          onSelect={(id) =>
            setManualSelection({
              index: Number(id),
              whenField: activeHighlightField,
            })
          }
        />
        {action && <div className="mb-1 ml-auto shrink-0">{action}</div>}
      </div>
      <div className="min-h-0 flex-1">
        <AnnotatedImage
          imageUrl={getSignedImageUrl(imageUrl)}
          validationItems={validationItems}
          activeField={activeHighlightField}
          onFieldClick={onFieldClick}
          colorMode="neutral"
          placeholderUrl={placeholderUrls?.[activeImageIndex]}
          isScanning={isScanning}
          images={tabImages}
          selectedImageId={String(activeImageIndex)}
          onImageSelect={(id) =>
            setManualSelection({
              index: Number(id),
              whenField: activeHighlightField,
            })
          }
        />
      </div>
    </div>
  )
}
