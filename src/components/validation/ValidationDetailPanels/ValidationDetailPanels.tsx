'use client'

import { useState, useCallback } from 'react'

import {
  AnnotatedImage,
  type ValidationItemBox,
} from '@/components/validation/AnnotatedImage'
import { ImageTabs } from '@/components/validation/ImageTabs'
import { FieldComparisonRow } from '@/components/shared/FieldComparisonRow'
import type {
  LabelImageData,
  ValidationItemData,
} from '@/lib/labels/detail-panel-types'

function FieldSummaryHeader({ items }: { items: ValidationItemData[] }) {
  const total = items.length
  const matchCount = items.filter((i) => i.status === 'match').length
  const mismatchCount = items.filter(
    (i) => i.status === 'mismatch' || i.status === 'needs_correction',
  ).length
  const notFoundCount = items.filter((i) => i.status === 'not_found').length
  const matchPercent = total > 0 ? (matchCount / total) * 100 : 0
  const mismatchPercent = total > 0 ? (mismatchCount / total) * 100 : 0

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-bold tracking-tight">
          Field Comparison
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {matchCount} of {total} fields match
        </p>
      </div>
      {/* Stacked progress bar */}
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
        {matchPercent > 0 && (
          <div
            className="rounded-full bg-green-500 transition-all duration-300 ease-out"
            style={{ width: `${matchPercent}%` }}
          />
        )}
        {mismatchPercent > 0 && (
          <div
            className="rounded-full bg-red-500 transition-all duration-300 ease-out"
            style={{ width: `${mismatchPercent}%` }}
          />
        )}
      </div>
      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-green-500" />
          {matchCount} Match{matchCount !== 1 ? 'es' : ''}
        </span>
        {mismatchCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-red-500" />
            {mismatchCount} Mismatch{mismatchCount !== 1 ? 'es' : ''}
          </span>
        )}
        {notFoundCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
            {notFoundCount} Not Found
          </span>
        )}
      </div>
    </div>
  )
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
        <div className="min-h-0 flex-1 overflow-hidden">
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

      {/* Right column — field comparisons, scrolls with page */}
      <div className="space-y-3.5 pb-6">
        <FieldSummaryHeader items={validationItems} />
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
    </div>
  )
}
