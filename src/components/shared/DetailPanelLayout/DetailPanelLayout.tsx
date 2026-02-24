'use client'

import type { ReactNode } from 'react'

import {
  AnnotatedImage,
  type SpecialistAnnotation,
  type ValidationItemBox,
} from '@/components/validation/AnnotatedImage'
import { ImageTabs } from '@/components/validation/ImageTabs'
import type { LabelImageData } from '@/lib/labels/detail-panel-types'

interface DetailPanelLayoutProps {
  /** All images for this label */
  images: LabelImageData[]
  /** Currently selected image (from the navigation hook) */
  selectedImage: LabelImageData | undefined
  selectedImageId: string
  onImageSelect: (id: string) => void
  /** Bounding box overlays for the image viewer */
  annotationItems: ValidationItemBox[]
  activeField: string | null
  onFieldClick: (fieldName: string) => void
  /** Right column content */
  children: ReactNode
  /** Drawing mode props (review panel only) */
  drawingFieldName?: string | null
  onDrawingComplete?: (
    fieldName: string,
    bbox: { x: number; y: number; width: number; height: number },
  ) => void
  onDrawingCancel?: () => void
  annotations?: SpecialistAnnotation[]
  /** Extra class on the image container (e.g. border + background for review) */
  imageContainerClassName?: string
}

export function DetailPanelLayout({
  images,
  selectedImage,
  selectedImageId,
  onImageSelect,
  annotationItems,
  activeField,
  onFieldClick,
  children,
  drawingFieldName,
  onDrawingComplete,
  onDrawingCancel,
  annotations,
  imageContainerClassName,
}: DetailPanelLayoutProps) {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[55%_1fr]">
      {/* Left column — sticky image + tabs (stacks on mobile) */}
      <div className="flex h-[60vh] flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <ImageTabs
          images={images}
          selectedImageId={selectedImageId}
          onSelect={onImageSelect}
        />
        <div
          className={`min-h-0 flex-1 overflow-hidden ${imageContainerClassName ?? ''}`}
        >
          {selectedImage && (
            <AnnotatedImage
              imageUrl={selectedImage.imageUrl}
              validationItems={annotationItems}
              activeField={activeField}
              onFieldClick={onFieldClick}
              images={images}
              selectedImageId={selectedImageId}
              onImageSelect={onImageSelect}
              drawingFieldName={drawingFieldName}
              onDrawingComplete={onDrawingComplete}
              onDrawingCancel={onDrawingCancel}
              annotations={annotations}
            />
          )}
        </div>
      </div>

      {/* Right column — content slot, scrolls with page */}
      {children}
    </div>
  )
}
