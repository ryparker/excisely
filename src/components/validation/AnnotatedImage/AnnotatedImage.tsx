'use client'

import {
  Eye,
  EyeOff,
  Home,
  Maximize2,
  Minimize2,
  RotateCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { formatFieldName } from '@/config/field-display-names'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import { cn } from '@/lib/utils'
import { ImageTabs } from '@/components/validation/ImageTabs'
import { ScanAnimation } from '@/components/validation/ScanAnimation'
import { usePanZoom } from '@/hooks/usePanZoom'
import { useDrawingMode } from '@/hooks/useDrawingMode'
import { useImageLoader } from '@/hooks/useImageLoader'
import { ImageViewerContent } from '@/components/validation/AnnotatedImage/ImageViewerContent'

export interface ValidationItemBox {
  fieldName: string
  status: string
  extractedValue: string | null
  confidence: number
  bboxX: number | null
  bboxY: number | null
  bboxWidth: number | null
  bboxHeight: number | null
  bboxAngle: number | null
  labelImageId?: string | null
}

export interface SpecialistAnnotation {
  fieldName: string
  x: number
  y: number
  width: number
  height: number
}

interface AnnotatedImageProps {
  imageUrl: string
  validationItems: ValidationItemBox[]
  activeField?: string | null
  onFieldClick?: (fieldName: string) => void
  /** When set, enters drawing mode for this field */
  drawingFieldName?: string | null
  /** Called when the user completes a rectangle drawing */
  onDrawingComplete?: (
    fieldName: string,
    bbox: { x: number; y: number; width: number; height: number },
  ) => void
  /** Called when the user cancels drawing (Escape) */
  onDrawingCancel?: () => void
  /** Previously drawn specialist annotations to render */
  annotations?: SpecialistAnnotation[]
  /** Color mode: 'validation' uses status colors, 'neutral' uses uniform indigo */
  colorMode?: 'validation' | 'neutral'
  /** Local preview URL shown while the main imageUrl loads (prevents blank flash) */
  placeholderUrl?: string
  /** When true, shows the scan animation overlay on the placeholder */
  isScanning?: boolean
  /** Image tabs for the expanded lightbox (optional — when provided, tabs appear in expanded view) */
  images?: Array<{ id: string; imageUrl: string; imageType: string }>
  /** Currently selected image ID (paired with images) */
  selectedImageId?: string
  /** Called when the user switches images via the expanded view tabs */
  onImageSelect?: (imageId: string) => void
}

export function AnnotatedImage({
  imageUrl,
  validationItems,
  activeField,
  onFieldClick,
  drawingFieldName,
  onDrawingComplete,
  onDrawingCancel,
  annotations,
  colorMode = 'validation',
  placeholderUrl,
  isScanning = false,
  images,
  selectedImageId,
  onImageSelect,
}: AnnotatedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const expandedContainerRef = useRef<HTMLDivElement>(null)
  const [showOverlays, setShowOverlays] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  // --- Pan/Zoom for inline view ---
  const inline = usePanZoom({ containerRef })

  // --- Pan/Zoom for expanded view ---
  const expanded = usePanZoom({ containerRef: expandedContainerRef })

  // Drawing uses whichever container is active
  const activeContainerRef = isExpanded ? expandedContainerRef : containerRef

  // --- Drawing mode (shared between inline and expanded) ---
  const drawing = useDrawingMode({
    drawingFieldName: drawingFieldName ?? null,
    onDrawingComplete,
    onDrawingCancel,
    activeContainerRef,
  })

  // --- Image loading ---
  const imageLoader = useImageLoader({
    imageUrl,
    isScanning,
    containerRef,
    applyFitView: inline.applyFitView,
  })

  // Reset inline transform when image URL changes (e.g. tab switch)
  useEffect(() => {
    inline.setScale(1)
    inline.setTranslate({ x: 0, y: 0 })
    inline.setRotation(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on imageUrl change
  }, [imageUrl])

  // --- Expanded view lifecycle ---
  const handleExpand = useCallback(() => {
    expanded.setScale(1)
    expanded.setTranslate({ x: 0, y: 0 })
    setIsExpanded(true)
  }, [expanded])

  const handleCollapse = useCallback(() => {
    setIsExpanded(false)
  }, [])

  // Close expanded view on Escape (deferred when drawing — Escape first cancels drawing)
  useEffect(() => {
    if (!isExpanded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drawingFieldName) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, drawingFieldName])

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isExpanded])

  // Center image vertically when expanded view opens or the image changes
  useEffect(() => {
    if (!isExpanded) return
    const container = expandedContainerRef.current
    if (!container) return

    let imgEl: HTMLImageElement | null = null

    const refit = () => {
      const fit = expanded.computeFitView(container)
      expanded.setScale(fit.scale)
      expanded.setTranslate({ x: 0, y: fit.translateY })
      inline.setRotation(0)
    }

    // Wait a frame for the container to have layout dimensions
    const raf = requestAnimationFrame(() => {
      imgEl = container.querySelector('img')
      if (imgEl?.complete && imgEl.naturalWidth > 0) {
        refit()
      } else if (imgEl) {
        imgEl.addEventListener('load', refit, { once: true })
      }
    })
    return () => {
      cancelAnimationFrame(raf)
      imgEl?.removeEventListener('load', refit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expanded.computeFitView is stable
  }, [isExpanded, imageUrl])

  // Recalculate fit on container resize
  useEffect(() => {
    if (!imageLoader.imageLoaded || !containerRef.current) return
    const container = containerRef.current
    const observer = new ResizeObserver(() => {
      // Only refit if the user hasn't panned/zoomed (still in default view)
      if (inline.rotation === 0 && !activeField) {
        const fit = inline.computeFitView(container)
        inline.setScale(fit.scale)
        inline.setTranslate({ x: 0, y: fit.translateY })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [
    imageLoader.imageLoaded,
    inline.rotation,
    activeField,
    inline.computeFitView,
    inline,
  ])

  // Pan to center the active field's bounding box in view, or reset on deselect
  useEffect(() => {
    if (!containerRef.current || !imageLoader.imageLoaded) return

    // Deselected — reset to fit
    if (!activeField) {
      const fit = inline.computeFitView(containerRef.current)
      inline.setScale(fit.scale)
      inline.setTranslate({ x: 0, y: fit.translateY })
      inline.setRotation(0)
      return
    }

    const item = validationItems.find(
      (v) =>
        v.fieldName === activeField &&
        v.bboxX !== null &&
        v.bboxY !== null &&
        v.bboxWidth !== null &&
        v.bboxHeight !== null &&
        v.status !== 'not_found',
    )
    if (!item) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()

    // Center of the bounding box in normalized (0-1) coordinates
    const centerX = Number(item.bboxX) + Number(item.bboxWidth) / 2
    const centerY = Number(item.bboxY) + Number(item.bboxHeight) / 2

    const imageEl = container.querySelector('img')
    if (!imageEl) return
    const imageWidth = imageEl.naturalWidth || containerRect.width
    const imageHeight = imageEl.naturalHeight || containerRect.height
    const displayWidth = containerRect.width
    const displayHeight = (imageHeight / imageWidth) * displayWidth

    // Use stored text angle from OCR, fall back to aspect ratio heuristic
    const boxWidthPx = Number(item.bboxWidth) * displayWidth
    const boxHeightPx = Number(item.bboxHeight) * displayHeight
    let targetRotation = 0
    if (item.bboxAngle !== null && item.bboxAngle !== 0) {
      targetRotation = -item.bboxAngle
    } else if (boxHeightPx / boxWidthPx > 2) {
      targetRotation = 90
    }
    inline.setRotation(targetRotation)

    // When rotated 90° or -90°, the bbox's effective screen dimensions swap
    const isRotated90 = Math.abs(targetRotation) === 90
    const effectiveBoxW = isRotated90 ? boxHeightPx : boxWidthPx
    const effectiveBoxH = isRotated90 ? boxWidthPx : boxHeightPx

    const fitScale = Math.min(
      containerRect.width / (effectiveBoxW * 2),
      containerRect.height / (effectiveBoxH * 2),
    )
    const fit = inline.computeFitView(container)
    const targetScale = Math.min(2.5, Math.max(fit.scale, fitScale))

    // Box center offset from transform-origin (image center)
    const dx = centerX * displayWidth - displayWidth / 2
    const dy = centerY * displayHeight - displayHeight / 2

    // Compute translate accounting for rotation
    const r = (targetRotation * Math.PI) / 180
    const cosR = Math.cos(r)
    const sinR = Math.sin(r)
    const newTranslate = {
      x: -(targetScale * (cosR * dx - sinR * dy)),
      y:
        containerRect.height / 2 -
        displayHeight / 2 -
        targetScale * (sinR * dx + cosR * dy),
    }

    inline.setScale(targetScale)
    inline.setTranslate(newTranslate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inline.computeFitView is stable, inline setters are stable
  }, [activeField, validationItems, imageLoader.imageLoaded])

  // --- Composed mouse handlers (drawing intercepts first, then pan/zoom) ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (drawing.handleDrawMouseDown(e)) return
      inline.startDrag(e)
    },
    [drawing, inline],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drawing.handleDrawMouseMove(e)) return
      inline.moveDrag(e)
    },
    [drawing, inline],
  )

  const handleMouseUp = useCallback(() => {
    if (drawing.handleDrawMouseUp()) return
    inline.endDrag()
  }, [drawing, inline])

  const handleExpandedMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (drawing.handleDrawMouseDown(e)) return
      expanded.startDrag(e)
    },
    [drawing, expanded],
  )

  const handleExpandedMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (drawing.handleDrawMouseMove(e)) return
      expanded.moveDrag(e)
    },
    [drawing, expanded],
  )

  const handleExpandedMouseUp = useCallback(() => {
    if (drawing.handleDrawMouseUp()) return
    expanded.endDrag()
  }, [drawing, expanded])

  const handleExpandedDoubleClick = useCallback(() => {
    expanded.setScale(1)
    expanded.setTranslate({ x: 0, y: 0 })
  }, [expanded])

  // Rotation is shared — inline.setRotation controls both views
  const handleRotate = useCallback(() => {
    inline.setRotation((prev) => (prev + 90) % 360)
  }, [inline])

  const handleExpandedReset = useCallback(() => {
    inline.setRotation(0)
    const container = expandedContainerRef.current
    if (container) {
      const fit = expanded.computeFitView(container)
      expanded.setScale(fit.scale)
      expanded.setTranslate({ x: 0, y: fit.translateY })
    } else {
      expanded.setScale(1)
      expanded.setTranslate({ x: 0, y: 0 })
    }
  }, [inline, expanded])

  const boxesWithCoords = useMemo(
    () =>
      validationItems.filter(
        (item) =>
          item.bboxX !== null &&
          item.bboxY !== null &&
          item.bboxWidth !== null &&
          item.bboxHeight !== null &&
          item.status !== 'not_found',
      ),
    [validationItems],
  )

  // Auto-hide overlays when in drawing mode for a clean view
  const effectiveShowOverlays = drawing.isDrawing ? false : showOverlays

  return (
    <>
      <div className="relative flex h-full flex-col">
        {/* Placeholder: show local preview while remote loads, with scan overlay when extracting */}
        {placeholderUrl && !imageLoader.imageError && (
          <div
            className={cn(
              'absolute inset-0 z-10 overflow-hidden rounded-lg border bg-muted bg-[linear-gradient(oklch(0.5_0_0/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.5_0_0/0.04)_1px,transparent_1px)] bg-[length:20px_20px]',
              isScanning || !imageLoader.isPositioned
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 transition-opacity duration-500 ease-out',
            )}
          >
            <div className="flex h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={placeholderUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {imageLoader.showScanAnim && <ScanAnimation />}
          </div>
        )}

        {/* Drawing mode banner */}
        {drawing.isDrawing && drawingFieldName && (
          <div
            className="flex shrink-0 items-center justify-center gap-2 rounded-t-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            role="status"
          >
            {drawing.pendingRect ? (
              <>
                Adjust the rectangle, then{' '}
                <button
                  type="button"
                  className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                  onClick={drawing.handleConfirmPending}
                >
                  Confirm
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                  onClick={drawing.handleRedrawPending}
                >
                  Redraw
                </button>
              </>
            ) : (
              <>
                Draw a rectangle around{' '}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <strong className="cursor-help border-b border-dashed border-white/40">
                        {formatFieldName(drawingFieldName)}
                      </strong>
                    </TooltipTrigger>
                    {FIELD_TOOLTIPS[drawingFieldName] && (
                      <TooltipContent side="bottom" className="max-w-xs">
                        {FIELD_TOOLTIPS[drawingFieldName].description}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            <kbd className="ml-1 rounded border border-indigo-400/50 bg-indigo-500/50 px-1.5 py-0.5 font-mono text-xs text-indigo-100">
              Esc
            </kbd>
            <span className="text-indigo-200">
              {drawing.pendingRect ? 'to redraw' : 'to cancel'}
            </span>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <ImageViewerContent
            imageUrl={imageUrl}
            boxesWithCoords={boxesWithCoords}
            activeField={activeField}
            onFieldClick={drawing.isDrawing ? undefined : onFieldClick}
            showOverlays={effectiveShowOverlays}
            scale={inline.scale}
            translate={inline.translate}
            rotation={inline.rotation}
            isDragging={inline.isDragging}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={inline.handleDoubleClick}
            containerRef={containerRef}
            isDrawing={drawing.isDrawing && !drawing.pendingRect}
            hasTopBanner={drawing.isDrawing}
            drawingRect={drawing.drawingRect}
            pendingRect={drawing.pendingRect}
            onPendingMouseDown={drawing.handlePendingMouseDown}
            onConfirmPending={drawing.handleConfirmPending}
            onRedrawPending={drawing.handleRedrawPending}
            annotations={annotations}
            imageError={imageLoader.imageError}
            onImageError={imageLoader.handleImageError}
            onImageLoad={imageLoader.handleImageLoad}
            colorMode={colorMode}
            enableTransition={imageLoader.isPositioned}
          />

          {/* Live crop preview */}
          <CropPreview
            drawingRect={drawing.drawingRect}
            pendingRect={drawing.pendingRect}
            imageUrl={imageUrl}
            imageAspect={imageLoader.imageAspect}
            bottomOffset={52}
            topOffset={48}
          />

          {/* Controls toolbar */}
          <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-md">
            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={() => setShowOverlays((prev) => !prev)}
              aria-label={showOverlays ? 'Hide highlights' : 'Show highlights'}
              title={showOverlays ? 'Hide highlights' : 'Show highlights'}
            >
              {showOverlays ? (
                <Eye className="size-3.5" />
              ) : (
                <EyeOff className="size-3.5" />
              )}
            </button>

            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={handleRotate}
              aria-label="Rotate 90°"
              title="Rotate 90°"
            >
              <RotateCw className="size-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={inline.reset}
              aria-label="Reset view"
              title="Reset view"
            >
              <Home className="size-3.5" />
            </button>

            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={handleExpand}
              aria-label="Expand image"
              title="Expand image"
            >
              <Maximize2 className="size-3.5" />
            </button>

            <div className="mx-0.5 h-5 w-px bg-border" />

            <div className="flex items-center text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                onClick={inline.zoomOut}
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="min-w-[3ch] text-center text-[11px] tabular-nums">
                {Math.round(inline.scale * 100)}%
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                onClick={inline.zoomIn}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded lightbox overlay */}
      {isExpanded &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={drawing.isDrawing ? undefined : handleCollapse}
          >
            <div
              className="relative flex max-h-[85vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
              style={{ height: '85vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute top-3 right-3 z-20 flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                onClick={handleCollapse}
                aria-label="Close expanded view"
              >
                <X className="h-4 w-4" />
              </button>

              {images &&
                images.length > 1 &&
                selectedImageId &&
                onImageSelect && (
                  <div className="shrink-0 border-b px-4 pt-3 pb-1">
                    <ImageTabs
                      images={images}
                      selectedImageId={selectedImageId}
                      onSelect={onImageSelect}
                    />
                  </div>
                )}

              {/* Drawing mode banner */}
              {drawing.isDrawing && drawingFieldName && (
                <div
                  className="flex shrink-0 items-center justify-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                  role="status"
                >
                  {drawing.pendingRect ? (
                    <>
                      Adjust the rectangle, then{' '}
                      <button
                        type="button"
                        className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                        onClick={drawing.handleConfirmPending}
                      >
                        Confirm
                      </button>{' '}
                      or{' '}
                      <button
                        type="button"
                        className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                        onClick={drawing.handleRedrawPending}
                      >
                        Redraw
                      </button>
                    </>
                  ) : (
                    <>
                      Draw a rectangle around{' '}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <strong className="cursor-help border-b border-dashed border-white/40">
                              {formatFieldName(drawingFieldName)}
                            </strong>
                          </TooltipTrigger>
                          {FIELD_TOOLTIPS[drawingFieldName] && (
                            <TooltipContent side="bottom" className="max-w-xs">
                              {FIELD_TOOLTIPS[drawingFieldName].description}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  <kbd className="ml-1 rounded border border-indigo-400/50 bg-indigo-500/50 px-1.5 py-0.5 font-mono text-xs text-indigo-100">
                    Esc
                  </kbd>
                  <span className="text-indigo-200">
                    {drawing.pendingRect ? 'to redraw' : 'to cancel'}
                  </span>
                </div>
              )}

              {/* Image viewer fills remaining space */}
              <div className="relative min-h-0 flex-1">
                <ImageViewerContent
                  imageUrl={imageUrl}
                  boxesWithCoords={boxesWithCoords}
                  activeField={activeField}
                  onFieldClick={drawing.isDrawing ? undefined : onFieldClick}
                  showOverlays={effectiveShowOverlays}
                  scale={expanded.scale}
                  translate={expanded.translate}
                  rotation={inline.rotation}
                  isDragging={expanded.isDragging}
                  onMouseDown={handleExpandedMouseDown}
                  onMouseMove={handleExpandedMouseMove}
                  onMouseUp={handleExpandedMouseUp}
                  onDoubleClick={
                    drawing.isDrawing ? () => {} : handleExpandedDoubleClick
                  }
                  containerRef={expandedContainerRef}
                  isDrawing={drawing.isDrawing && !drawing.pendingRect}
                  drawingRect={drawing.drawingRect}
                  pendingRect={drawing.pendingRect}
                  onPendingMouseDown={drawing.handlePendingMouseDown}
                  onConfirmPending={drawing.handleConfirmPending}
                  onRedrawPending={drawing.handleRedrawPending}
                  annotations={annotations}
                  colorMode={colorMode}
                />

                {/* Crop preview (expanded view) */}
                <CropPreview
                  drawingRect={drawing.drawingRect}
                  pendingRect={drawing.pendingRect}
                  imageUrl={imageUrl}
                  imageAspect={imageLoader.imageAspect}
                  bottomOffset={52}
                  topOffset={12}
                />

                {/* Expanded view controls toolbar */}
                <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    onClick={() => setShowOverlays((prev) => !prev)}
                    aria-label={
                      showOverlays ? 'Hide highlights' : 'Show highlights'
                    }
                    title={showOverlays ? 'Hide highlights' : 'Show highlights'}
                  >
                    {showOverlays ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    onClick={handleRotate}
                    aria-label="Rotate 90°"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    onClick={handleExpandedReset}
                    aria-label="Reset view"
                    title="Reset view"
                  >
                    <Home className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    onClick={handleCollapse}
                    aria-label="Collapse image"
                    title="Collapse image"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex items-center gap-1 rounded-md bg-background/80 px-1 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
                    <button
                      type="button"
                      className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
                      onClick={expanded.zoomOut}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <span className="min-w-[3ch] text-center tabular-nums">
                      {Math.round(expanded.scale * 100)}%
                    </span>
                    <button
                      type="button"
                      className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
                      onClick={expanded.zoomIn}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

// --- Crop Preview (extracted to avoid duplication between inline and expanded) ---

interface CropPreviewProps {
  drawingRect: { x: number; y: number; width: number; height: number } | null
  pendingRect: { x: number; y: number; width: number; height: number } | null
  imageUrl: string
  imageAspect: number
  bottomOffset: number
  topOffset: number
}

function CropPreview({
  drawingRect,
  pendingRect,
  imageUrl,
  imageAspect,
  bottomOffset,
  topOffset,
}: CropPreviewProps) {
  const previewSource = pendingRect ?? drawingRect
  if (
    !previewSource ||
    previewSource.width < 0.01 ||
    previewSource.height < 0.01
  )
    return null

  const cropAspect = (previewSource.width * imageAspect) / previewSource.height

  const MAX_DIM = 220
  const MIN_DIM = 80
  let previewW: number
  let previewH: number
  if (cropAspect >= 1) {
    previewW = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
    previewH = Math.max(MIN_DIM, Math.round(previewW / cropAspect))
  } else {
    previewH = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
    previewW = Math.max(MIN_DIM, Math.round(previewH * cropAspect))
  }

  const imgW = previewW / previewSource.width
  const imgH = previewH / previewSource.height

  const rectCenterX = previewSource.x + previewSource.width / 2
  const rectCenterY = previewSource.y + previewSource.height / 2
  const placeRight = rectCenterX < 0.5
  const placeBottom = rectCenterY < 0.5

  const positionStyle: React.CSSProperties = {
    width: previewW,
    height: previewH,
    ...(placeRight ? { right: 12 } : { left: 12 }),
    ...(placeBottom ? { bottom: bottomOffset } : { top: topOffset }),
  }

  return (
    <div
      className="pointer-events-none absolute z-20 overflow-hidden rounded-lg border-2 border-indigo-500/80 bg-black shadow-xl transition-[top,right,bottom,left] duration-200"
      style={positionStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Crop preview"
        draggable={false}
        className="absolute block"
        style={{
          width: imgW,
          height: imgH,
          left: -previewSource.x * imgW,
          top: -previewSource.y * imgH,
          maxWidth: 'none',
        }}
      />
      <span className="absolute top-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        Preview
      </span>
    </div>
  )
}
