'use client'

import { useMemo } from 'react'

import { AnnotatedImage } from '@/components/validation/AnnotatedImage'
import { ImageTabs } from '@/components/validation/ImageTabs'
import { FieldComparisonRow } from '@/components/shared/FieldComparisonRow'
import { useImageFieldNavigation } from '@/hooks/useImageFieldNavigation'
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
  const confidenceOverride = useMemo(
    () => (hideInternals ? () => 0 : undefined),
    [hideInternals],
  )

  const {
    activeField,
    selectedImage,
    handleFieldClick,
    handleImageSelect,
    annotationItems,
  } = useImageFieldNavigation({
    images,
    validationItems,
    confidenceOverride,
  })

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[55%_1fr]">
      {/* Left column — sticky image + tabs (stacks on mobile) */}
      <div className="flex h-[60vh] flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <ImageTabs
          images={images}
          selectedImageId={selectedImage?.id ?? ''}
          onSelect={handleImageSelect}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedImage && (
            <AnnotatedImage
              imageUrl={selectedImage.imageUrl}
              validationItems={annotationItems}
              activeField={activeField}
              onFieldClick={handleFieldClick}
              images={images}
              selectedImageId={selectedImage.id}
              onImageSelect={handleImageSelect}
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
