'use client'

import {
  Check,
  Eye,
  EyeOff,
  Home,
  Maximize2,
  Minimize2,
  RotateCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import { cn } from '@/lib/utils'
import { ImageTabs } from '@/components/validation/image-tabs'
import { ScanAnimation } from '@/components/validation/scan-animation'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const STATUS_COLORS: Record<
  string,
  { border: string; bg: string; hoverBorder: string; hoverBg: string }
> = {
  match: {
    border: 'border-green-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-green-500',
    hoverBg: 'group-hover/box:bg-green-500/10',
  },
  mismatch: {
    border: 'border-red-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-red-500',
    hoverBg: 'group-hover/box:bg-red-500/10',
  },
  needs_correction: {
    border: 'border-amber-500/50',
    bg: '',
    hoverBorder: 'group-hover/box:border-amber-500',
    hoverBg: 'group-hover/box:bg-amber-500/10',
  },
}

const ACTIVE_COLORS: Record<
  string,
  { border: string; bg: string; shadow: string }
> = {
  match: {
    border: 'border-green-500',
    bg: 'bg-green-500/20',
    shadow: '0 0 12px 2px rgba(34,197,94,0.5)',
  },
  mismatch: {
    border: 'border-red-500',
    bg: 'bg-red-500/20',
    shadow: '0 0 12px 2px rgba(239,68,68,0.5)',
  },
  needs_correction: {
    border: 'border-amber-500',
    bg: 'bg-amber-500/20',
    shadow: '0 0 12px 2px rgba(245,158,11,0.5)',
  },
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  match: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  mismatch: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  needs_correction:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  not_found: 'bg-secondary text-muted-foreground',
  neutral:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const NEUTRAL_COLORS = {
  border: 'border-indigo-400/50',
  bg: '',
  hoverBorder: 'group-hover/box:border-indigo-500',
  hoverBg: 'group-hover/box:bg-indigo-500/10',
}

const NEUTRAL_ACTIVE_COLORS = {
  border: 'border-indigo-500',
  bg: 'bg-indigo-500/20',
  shadow: '0 0 12px 2px rgba(99,102,241,0.5)',
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  w: 'ew-resize',
  e: 'ew-resize',
  sw: 'nesw-resize',
  s: 'ns-resize',
  se: 'nwse-resize',
}

const HANDLE_POSITIONS: { handle: ResizeHandle; x: number; y: number }[] = [
  { handle: 'nw', x: 0, y: 0 },
  { handle: 'n', x: 0.5, y: 0 },
  { handle: 'ne', x: 1, y: 0 },
  { handle: 'w', x: 0, y: 0.5 },
  { handle: 'e', x: 1, y: 0.5 },
  { handle: 'sw', x: 0, y: 1 },
  { handle: 's', x: 0.5, y: 1 },
  { handle: 'se', x: 1, y: 1 },
]

/** Invert CSS transform (translate + scale with origin-center) to get normalized image coords. */
function screenToNormalizedCoords(
  clientX: number,
  clientY: number,
  container: HTMLDivElement | null,
  currentScale: number,
  currentTranslate: { x: number; y: number },
): { x: number; y: number } | null {
  if (!container) return null
  const containerRect = container.getBoundingClientRect()
  const imageEl = container.querySelector('img')
  if (!imageEl) return null

  const imageWidth = imageEl.naturalWidth || containerRect.width
  const imageHeight = imageEl.naturalHeight || containerRect.height
  const displayWidth = containerRect.width
  const displayHeight = (imageHeight / imageWidth) * displayWidth

  const relScreenX = clientX - containerRect.left
  const relScreenY = clientY - containerRect.top
  const relX =
    (relScreenX - displayWidth / 2 - currentTranslate.x) / currentScale +
    displayWidth / 2
  const relY =
    (relScreenY - displayHeight / 2 - currentTranslate.y) / currentScale +
    displayHeight / 2

  return {
    x: Math.max(0, Math.min(1, relX / displayWidth)),
    y: Math.max(0, Math.min(1, relY / displayHeight)),
  }
}

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

/** Shared image content: pannable/zoomable image with optional bounding box overlays */
function ImageViewerContent({
  imageUrl,
  boxesWithCoords,
  activeField,
  onFieldClick,
  showOverlays,
  scale,
  translate,
  rotation,
  isDragging,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  containerRef,
  isDrawing,
  hasTopBanner,
  drawingRect,
  pendingRect,
  onPendingMouseDown,
  onConfirmPending,
  onRedrawPending,
  annotations,
  onImageLoad,
  onImageError,
  imageError,
  colorMode = 'validation',
  enableTransition = true,
}: {
  imageUrl: string
  boxesWithCoords: ValidationItemBox[]
  activeField?: string | null
  onFieldClick?: (fieldName: string) => void
  showOverlays: boolean
  scale: number
  translate: { x: number; y: number }
  rotation: number
  isDragging: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  onDoubleClick: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
  isDrawing?: boolean
  hasTopBanner?: boolean
  drawingRect?: { x: number; y: number; width: number; height: number } | null
  pendingRect?: { x: number; y: number; width: number; height: number } | null
  onPendingMouseDown?: (
    e: React.MouseEvent,
    handle: ResizeHandle | 'move',
  ) => void
  onConfirmPending?: () => void
  onRedrawPending?: () => void
  annotations?: SpecialistAnnotation[]
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onImageError?: () => void
  imageError?: boolean
  colorMode?: 'validation' | 'neutral'
  /** When false, transform changes are applied instantly (no CSS transition). */
  enableTransition?: boolean
}) {
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full overflow-hidden border bg-muted bg-[linear-gradient(oklch(0.5_0_0/0.08)_1px,transparent_1px),linear-gradient(90deg,oklch(0.5_0_0/0.08)_1px,transparent_1px)] bg-[length:20px_20px]',
        hasTopBanner ? 'rounded-b-lg border-t-0' : 'rounded-lg',
        isDrawing
          ? 'cursor-crosshair'
          : isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab',
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={isDrawing ? undefined : onDoubleClick}
    >
      <div
        className={cn(
          'relative origin-center',
          enableTransition && 'transition-transform duration-300 ease-out',
        )}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
        }}
      >
        {imageError ? (
          <div className="flex h-64 items-center justify-center bg-muted text-muted-foreground">
            Image failed to load
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Label image"
            className="block h-auto w-full"
            draggable={false}
            onLoad={onImageLoad}
            onError={onImageError}
          />
        )}

        {/* Specialist-drawn annotations */}
        {showOverlays &&
          annotations?.map((ann) => (
            <div
              key={ann.fieldName}
              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-indigo-500/70 bg-indigo-500/10"
              style={{
                left: `${ann.x * 100}%`,
                top: `${ann.y * 100}%`,
                width: `${ann.width * 100}%`,
                height: `${ann.height * 100}%`,
              }}
            >
              <span className="absolute -top-5 left-0 rounded bg-indigo-600 px-1 py-0.5 text-[9px] font-medium whitespace-nowrap text-white">
                Specialist
              </span>
            </div>
          ))}

        {/* Drawing preview rectangle (while actively dragging) */}
        {drawingRect && !pendingRect && (
          <div
            className="pointer-events-none absolute rounded-sm border-2 border-dashed border-indigo-400 bg-indigo-400/20"
            style={{
              left: `${drawingRect.x * 100}%`,
              top: `${drawingRect.y * 100}%`,
              width: `${drawingRect.width * 100}%`,
              height: `${drawingRect.height * 100}%`,
            }}
          />
        )}

        {/* Pending rectangle with resize handles (adjustment mode) */}
        {pendingRect && (
          <div
            className="absolute rounded-sm border-2 border-indigo-500 bg-indigo-500/15"
            style={{
              left: `${pendingRect.x * 100}%`,
              top: `${pendingRect.y * 100}%`,
              width: `${pendingRect.width * 100}%`,
              height: `${pendingRect.height * 100}%`,
              cursor: 'move',
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onPendingMouseDown?.(e, 'move')
            }}
          >
            {/* Resize handles */}
            {HANDLE_POSITIONS.map(({ handle, x, y }) => (
              <div
                key={handle}
                aria-label={`Resize ${handle}`}
                tabIndex={0}
                className="absolute z-10 size-2 rounded-sm border border-indigo-600 bg-white shadow-sm"
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: HANDLE_CURSORS[handle],
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onPendingMouseDown?.(e, handle)
                }}
              />
            ))}

            {/* Confirm / Redraw buttons */}
            <div
              className="absolute -bottom-10 left-1/2 z-20 flex -translate-x-1/2 gap-1.5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-md transition-colors hover:bg-indigo-700 active:scale-95"
                onClick={onConfirmPending}
              >
                <Check className="size-3" />
                Confirm
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:bg-muted active:scale-95"
                onClick={onRedrawPending}
              >
                <X className="size-3" />
                Redraw
              </button>
            </div>
          </div>
        )}

        {/* Interactive bounding box overlays */}
        {showOverlays && (
          <TooltipProvider delayDuration={150}>
            {boxesWithCoords.map((item) => {
              const isNeutral = colorMode === 'neutral'
              const isActive = activeField === item.fieldName
              const statusKey =
                item.status in STATUS_COLORS ? item.status : 'match'
              const colors = isNeutral
                ? NEUTRAL_COLORS
                : STATUS_COLORS[statusKey]
              const activeColors = isNeutral
                ? NEUTRAL_ACTIVE_COLORS
                : ACTIVE_COLORS[statusKey]
              const label =
                FIELD_DISPLAY_NAMES[item.fieldName] ??
                item.fieldName.replace(/_/g, ' ')
              const confidencePercent = Math.round(item.confidence)
              const statusLabel = isNeutral
                ? 'Detected'
                : item.status === 'needs_correction'
                  ? 'Needs Correction'
                  : item.status === 'not_found'
                    ? 'Not Found'
                    : item.status.charAt(0).toUpperCase() + item.status.slice(1)

              return (
                <Tooltip key={item.fieldName}>
                  <TooltipTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'group/box absolute cursor-pointer rounded-sm border-2 transition-[border-color,background-color,box-shadow] duration-150',
                        isActive
                          ? cn(
                              activeColors.border,
                              activeColors.bg,
                              'border-[3px]',
                            )
                          : cn(
                              colors.border,
                              colors.bg,
                              colors.hoverBorder,
                              colors.hoverBg,
                            ),
                      )}
                      style={{
                        left: `calc(${Number(item.bboxX) * 100}% - 4px)`,
                        top: `calc(${Number(item.bboxY) * 100}% - 4px)`,
                        width: `calc(${Number(item.bboxWidth) * 100}% + 8px)`,
                        height: `calc(${Number(item.bboxHeight) * 100}% + 8px)`,
                        boxShadow: isActive ? activeColors.shadow : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onFieldClick?.(item.fieldName)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onFieldClick?.(item.fieldName)
                        }
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-xs border bg-popover text-popover-foreground shadow-md"
                  >
                    <div className="space-y-1.5 p-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold">{label}</span>
                        {!isNeutral && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              'px-1.5 py-0 text-[10px]',
                              STATUS_BADGE_STYLE[item.status] ?? '',
                            )}
                          >
                            {statusLabel}
                          </Badge>
                        )}
                      </div>
                      {item.extractedValue && (
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                          {item.extractedValue}
                        </p>
                      )}
                      {!isNeutral && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {confidencePercent}% confidence
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        )}
      </div>
    </div>
  )
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
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showOverlays, setShowOverlays] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [rotation, setRotation] = useState(0)
  // Tracks whether the image has been loaded AND positioned (centered).
  // While false, the viewer is hidden (opacity-0) and transitions are disabled
  // so the image doesn't flash at (0,0) then slide to center.
  const [isPositioned, setIsPositioned] = useState(false)
  // Once true, subsequent image switches (e.g. multi-image tab changes) skip
  // resetting isPositioned so the placeholder overlay doesn't cover bounding
  // boxes while the next image loads from the proxy.
  const hasBeenPositionedRef = useRef(false)

  // Delayed scan animation visibility — stays true for 500ms after isScanning
  // becomes false so the animation fades out with the placeholder overlay.
  const [showScanAnim, setShowScanAnim] = useState(false)
  useEffect(() => {
    if (isScanning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing derived visual state with isScanning prop
      setShowScanAnim(true)
    } else {
      const t = setTimeout(() => setShowScanAnim(false), 500)
      return () => clearTimeout(t)
    }
  }, [isScanning])

  // Drawing state
  const [isDrawingActive, setIsDrawingActive] = useState(false)
  const [drawStart, setDrawStart] = useState<{
    x: number
    y: number
  } | null>(null)
  const [drawingRect, setDrawingRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const isDrawing = !!drawingFieldName

  // Adjustment mode state (pending rect not yet confirmed)
  const [pendingRect, setPendingRect] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [adjustMode, setAdjustMode] = useState<{
    type: 'move' | ResizeHandle
    startMouse: { x: number; y: number }
    startRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  // Separate zoom/pan state for expanded view
  const [expandedScale, setExpandedScale] = useState(1)
  const [expandedTranslate, setExpandedTranslate] = useState({ x: 0, y: 0 })
  const [expandedIsDragging, setExpandedIsDragging] = useState(false)
  const [expandedDragStart, setExpandedDragStart] = useState({ x: 0, y: 0 })

  // Reset expanded view state when opening
  const handleExpand = useCallback(() => {
    setExpandedScale(1)
    setExpandedTranslate({ x: 0, y: 0 })
    setIsExpanded(true)
  }, [])

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

  // Cancel drawing on Escape (two-level: adjustment → drawing → exit)
  useEffect(() => {
    if (!isDrawing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingRect) {
          // In adjustment mode → clear pending rect, stay in drawing mode
          setPendingRect(null)
          setAdjustMode(null)
        } else {
          // In drawing mode → exit entirely
          setIsDrawingActive(false)
          setDrawStart(null)
          setDrawingRect(null)
          setPendingRect(null)
          setAdjustMode(null)
          onDrawingCancel?.()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDrawing, onDrawingCancel, pendingRect])

  // Reset drawing state when drawingFieldName changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing drawing state with drawingFieldName prop
    setIsDrawingActive(false)
    setDrawStart(null)
    setDrawingRect(null)
    setPendingRect(null)
    setAdjustMode(null)
  }, [drawingFieldName])

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

  // --- Coordinate conversion for drawing ---
  const screenToNormalized = useCallback(
    (clientX: number, clientY: number) =>
      screenToNormalizedCoords(
        clientX,
        clientY,
        containerRef.current,
        scale,
        translate,
      ),
    [scale, translate],
  )

  // --- Inline view handlers ---
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP * 3))
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return

      // Don't start new draw while adjusting pending rect
      if (isDrawing && !pendingRect) {
        const norm = screenToNormalized(e.clientX, e.clientY)
        if (norm) {
          setIsDrawingActive(true)
          setDrawStart(norm)
          setDrawingRect({ x: norm.x, y: norm.y, width: 0, height: 0 })
        }
        return
      }

      if (isDrawing) return // In adjustment mode, ignore background clicks

      setIsDragging(true)
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
    },
    [translate, isDrawing, screenToNormalized, pendingRect],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Adjustment mode: move or resize pendingRect
      if (adjustMode && pendingRect) {
        const norm = screenToNormalized(e.clientX, e.clientY)
        if (!norm) return

        const dx = norm.x - adjustMode.startMouse.x
        const dy = norm.y - adjustMode.startMouse.y
        const r = adjustMode.startRect

        if (adjustMode.type === 'move') {
          setPendingRect({
            x: Math.max(0, Math.min(1 - r.width, r.x + dx)),
            y: Math.max(0, Math.min(1 - r.height, r.y + dy)),
            width: r.width,
            height: r.height,
          })
        } else {
          let newX = r.x
          let newY = r.y
          let newW = r.width
          let newH = r.height

          const h = adjustMode.type
          // Horizontal edges
          if (h === 'nw' || h === 'w' || h === 'sw') {
            newX = Math.min(r.x + r.width - 0.01, r.x + dx)
            newW = r.width - (newX - r.x)
          }
          if (h === 'ne' || h === 'e' || h === 'se') {
            newW = Math.max(0.01, r.width + dx)
          }
          // Vertical edges
          if (h === 'nw' || h === 'n' || h === 'ne') {
            newY = Math.min(r.y + r.height - 0.01, r.y + dy)
            newH = r.height - (newY - r.y)
          }
          if (h === 'sw' || h === 's' || h === 'se') {
            newH = Math.max(0.01, r.height + dy)
          }

          setPendingRect({
            x: Math.max(0, newX),
            y: Math.max(0, newY),
            width: Math.min(1 - Math.max(0, newX), newW),
            height: Math.min(1 - Math.max(0, newY), newH),
          })
        }
        return
      }

      if (isDrawingActive && drawStart) {
        const norm = screenToNormalized(e.clientX, e.clientY)
        if (norm) {
          const x = Math.min(drawStart.x, norm.x)
          const y = Math.min(drawStart.y, norm.y)
          const width = Math.abs(norm.x - drawStart.x)
          const height = Math.abs(norm.y - drawStart.y)
          setDrawingRect({ x, y, width, height })
        }
        return
      }

      if (!isDragging) return
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [
      isDragging,
      dragStart,
      isDrawingActive,
      drawStart,
      screenToNormalized,
      adjustMode,
      pendingRect,
    ],
  )

  const handleMouseUp = useCallback(() => {
    // End adjustment drag
    if (adjustMode) {
      setAdjustMode(null)
      return
    }

    if (isDrawingActive && drawingRect && drawingFieldName) {
      // Only register if the rectangle has meaningful size
      if (drawingRect.width > 0.005 && drawingRect.height > 0.005) {
        // Move to adjustment mode instead of committing immediately
        setPendingRect(drawingRect)
      }
      setIsDrawingActive(false)
      setDrawStart(null)
      setDrawingRect(null)
      return
    }
    setIsDragging(false)
  }, [isDrawingActive, drawingRect, drawingFieldName, adjustMode])

  // Start move or resize of pending rect (works in both inline and expanded views)
  const handlePendingMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle | 'move') => {
      if (!pendingRect) return
      const norm = isExpanded
        ? screenToNormalizedCoords(
            e.clientX,
            e.clientY,
            expandedContainerRef.current,
            expandedScale,
            expandedTranslate,
          )
        : screenToNormalized(e.clientX, e.clientY)
      if (!norm) return
      setAdjustMode({
        type: handle,
        startMouse: norm,
        startRect: { ...pendingRect },
      })
    },
    [
      pendingRect,
      screenToNormalized,
      isExpanded,
      expandedScale,
      expandedTranslate,
    ],
  )

  // Confirm pending rect → commit annotation
  const handleConfirmPending = useCallback(() => {
    if (pendingRect && drawingFieldName) {
      onDrawingComplete?.(drawingFieldName, pendingRect)
    }
    setPendingRect(null)
    setAdjustMode(null)
  }, [pendingRect, drawingFieldName, onDrawingComplete])

  // Redraw → clear pending rect, stay in drawing mode
  const handleRedrawPending = useCallback(() => {
    setPendingRect(null)
    setAdjustMode(null)
  }, [])

  // Compute the scale and translate needed to fit the image within the container
  // Inset (px) — matches the placeholder's p-4 so the image sits in the
  // same position during scanning and after the annotated viewer loads.
  const FIT_INSET = 16

  const computeFitView = useCallback(
    (container: HTMLDivElement): { scale: number; translateY: number } => {
      const containerRect = container.getBoundingClientRect()
      const imageEl = container.querySelector('img')
      if (!imageEl) return { scale: 1, translateY: 0 }
      const imageWidth = imageEl.naturalWidth || containerRect.width
      const imageHeight = imageEl.naturalHeight || containerRect.height
      // Available area after inset padding on all sides
      const availableWidth = containerRect.width - FIT_INSET * 2
      const availableHeight = containerRect.height - FIT_INSET * 2
      // Image displayed at container width; compute height at that width
      const displayWidth = containerRect.width
      const displayHeight = (imageHeight / imageWidth) * displayWidth
      // Scale so the image fits within the inset area (never upscale)
      const scaleX = availableWidth / displayWidth
      const scaleY = availableHeight / displayHeight
      const fitScale = Math.min(scaleX, scaleY, 1)
      // Horizontal centering is handled by transform-origin: center — scale
      // shrinks symmetrically so translateX is always 0.
      // Vertical centering: offset so the transform div (whose natural top
      // is 0) is centered within the container.
      const translateY = (containerRect.height - displayHeight) / 2
      return { scale: fitScale, translateY }
    },
    [],
  )

  // Center image vertically when expanded view opens
  useEffect(() => {
    if (!isExpanded) return
    const container = expandedContainerRef.current
    if (!container) return
    // Wait a frame for the container to have layout dimensions
    const raf = requestAnimationFrame(() => {
      const fit = computeFitView(container)
      setExpandedScale(fit.scale)
      setExpandedTranslate({ x: 0, y: fit.translateY })
    })
    return () => cancelAnimationFrame(raf)
  }, [isExpanded, computeFitView])

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const handleReset = useCallback(() => {
    if (containerRef.current) {
      const fit = computeFitView(containerRef.current)
      setScale(fit.scale)
      setTranslate({ x: 0, y: fit.translateY })
    } else {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
    setRotation(0)
  }, [computeFitView])

  const handleDoubleClick = handleReset

  // --- Expanded view handlers ---
  const handleExpandedZoomIn = useCallback(() => {
    setExpandedScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 3))
  }, [])

  const handleExpandedZoomOut = useCallback(() => {
    setExpandedScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP * 3))
  }, [])

  const handleExpandedMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return

      // Drawing mode
      if (isDrawing && !pendingRect) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          expandedContainerRef.current,
          expandedScale,
          expandedTranslate,
        )
        if (norm) {
          setIsDrawingActive(true)
          setDrawStart(norm)
          setDrawingRect({ x: norm.x, y: norm.y, width: 0, height: 0 })
        }
        return
      }

      if (isDrawing) return // In adjustment mode, ignore background clicks

      setExpandedIsDragging(true)
      setExpandedDragStart({
        x: e.clientX - expandedTranslate.x,
        y: e.clientY - expandedTranslate.y,
      })
    },
    [expandedTranslate, expandedScale, isDrawing, pendingRect],
  )

  const handleExpandedMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Adjustment mode: move or resize pendingRect
      if (adjustMode && pendingRect) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          expandedContainerRef.current,
          expandedScale,
          expandedTranslate,
        )
        if (!norm) return

        const dx = norm.x - adjustMode.startMouse.x
        const dy = norm.y - adjustMode.startMouse.y
        const r = adjustMode.startRect

        if (adjustMode.type === 'move') {
          setPendingRect({
            x: Math.max(0, Math.min(1 - r.width, r.x + dx)),
            y: Math.max(0, Math.min(1 - r.height, r.y + dy)),
            width: r.width,
            height: r.height,
          })
        } else {
          let newX = r.x
          let newY = r.y
          let newW = r.width
          let newH = r.height

          const h = adjustMode.type
          if (h === 'nw' || h === 'w' || h === 'sw') {
            newX = Math.min(r.x + r.width - 0.01, r.x + dx)
            newW = r.width - (newX - r.x)
          }
          if (h === 'ne' || h === 'e' || h === 'se') {
            newW = Math.max(0.01, r.width + dx)
          }
          if (h === 'nw' || h === 'n' || h === 'ne') {
            newY = Math.min(r.y + r.height - 0.01, r.y + dy)
            newH = r.height - (newY - r.y)
          }
          if (h === 'sw' || h === 's' || h === 'se') {
            newH = Math.max(0.01, r.height + dy)
          }

          setPendingRect({
            x: Math.max(0, newX),
            y: Math.max(0, newY),
            width: Math.min(1 - Math.max(0, newX), newW),
            height: Math.min(1 - Math.max(0, newY), newH),
          })
        }
        return
      }

      if (isDrawingActive && drawStart) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          expandedContainerRef.current,
          expandedScale,
          expandedTranslate,
        )
        if (norm) {
          const x = Math.min(drawStart.x, norm.x)
          const y = Math.min(drawStart.y, norm.y)
          const width = Math.abs(norm.x - drawStart.x)
          const height = Math.abs(norm.y - drawStart.y)
          setDrawingRect({ x, y, width, height })
        }
        return
      }

      if (!expandedIsDragging) return
      setExpandedTranslate({
        x: e.clientX - expandedDragStart.x,
        y: e.clientY - expandedDragStart.y,
      })
    },
    [
      expandedIsDragging,
      expandedDragStart,
      isDrawingActive,
      drawStart,
      adjustMode,
      pendingRect,
      expandedScale,
      expandedTranslate,
    ],
  )

  const handleExpandedMouseUp = useCallback(() => {
    if (adjustMode) {
      setAdjustMode(null)
      return
    }

    if (isDrawingActive && drawingRect && drawingFieldName) {
      if (drawingRect.width > 0.005 && drawingRect.height > 0.005) {
        setPendingRect(drawingRect)
      }
      setIsDrawingActive(false)
      setDrawStart(null)
      setDrawingRect(null)
      return
    }
    setExpandedIsDragging(false)
  }, [isDrawingActive, drawingRect, drawingFieldName, adjustMode])

  const handleExpandedDoubleClick = useCallback(() => {
    setExpandedScale(1)
    setExpandedTranslate({ x: 0, y: 0 })
  }, [])

  // Fit image once it loads (naturalWidth/Height are 0 before load)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageAspect, setImageAspect] = useState(1) // width / height

  // Reset loaded state when image URL changes (e.g. tab switch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing imageLoaded with imageUrl prop
    setImageLoaded(false)
    setImageError(false)
    // Only hide behind the placeholder overlay on the very first image load.
    // After the first image is positioned, keep isPositioned true during image
    // switches so the overlay doesn't cover bounding boxes while the next
    // image loads through the blob proxy.
    if (!hasBeenPositionedRef.current) {
      setIsPositioned(false)
    }
    // Reset transform so the old image's scale/translate doesn't show
    // through the placeholder overlay if the new image has a different
    // aspect ratio.
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setRotation(0)
  }, [imageUrl])

  // Also check for already-cached images on mount / URL change
  useEffect(() => {
    if (!containerRef.current) return
    const imageEl = containerRef.current.querySelector('img')
    if (imageEl?.complete && imageEl.naturalWidth > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- checking cached image state
      setImageLoaded(true)
    }
  }, [imageUrl])

  // Apply fit scale once the image has loaded
  const applyFitView = useCallback(() => {
    if (!containerRef.current) return
    const fit = computeFitView(containerRef.current)
    setScale(fit.scale)
    setTranslate({ x: 0, y: fit.translateY })
    setRotation(0)
  }, [computeFitView])

  useEffect(() => {
    if (!imageLoaded) return
    applyFitView()
    // Mark as positioned after the browser paints the centered position.
    // Double-rAF ensures the un-transitioned position is rendered before we
    // make the content visible and enable CSS transitions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsPositioned(true)
        hasBeenPositionedRef.current = true
      })
    })
  }, [imageLoaded, applyFitView])

  // Recalculate fit on container resize
  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return
    const container = containerRef.current
    const observer = new ResizeObserver(() => {
      // Only refit if the user hasn't panned/zoomed (still in default view)
      if (rotation === 0 && !activeField) {
        const fit = computeFitView(container)
        setScale(fit.scale)
        setTranslate({ x: 0, y: fit.translateY })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [imageLoaded, rotation, activeField, computeFitView])

  // Pan to center the active field's bounding box in view, or reset on deselect
  useEffect(() => {
    if (!containerRef.current || !imageLoaded) return

    // Deselected — reset to fit
    if (!activeField) {
      const fit = computeFitView(containerRef.current)
      setScale(fit.scale)
      setTranslate({ x: 0, y: fit.translateY })
      setRotation(0)
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

    // The image fills the container width; height = image aspect ratio * container width
    // At 100% zoom, image width = container width
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
      // Negate the text angle to correct the orientation
      // e.g., text at 90° (reading top-to-bottom) → rotate image -90°
      targetRotation = -item.bboxAngle
    } else if (boxHeightPx / boxWidthPx > 2) {
      // Legacy fallback: aspect ratio heuristic (assumes bottom-to-top reading)
      targetRotation = 90
    }
    setRotation(targetRotation)

    // When rotated 90° or -90°, the bbox's effective screen dimensions swap
    const isRotated90 = Math.abs(targetRotation) === 90
    const effectiveBoxW = isRotated90 ? boxHeightPx : boxWidthPx
    const effectiveBoxH = isRotated90 ? boxWidthPx : boxHeightPx

    // Target zoom: fit the bounding box with context padding.
    // Use 2x padding (bbox fills ~50% of the viewport).
    // For large fields (health warning, address), this keeps zoom gentle.
    // For small fields (ABV, net contents), this zooms in more.
    const fitScale = Math.min(
      containerRect.width / (effectiveBoxW * 2),
      containerRect.height / (effectiveBoxH * 2),
    )
    // Get the "fit whole image" scale as a floor — never zoom out beyond that
    const fit = computeFitView(container)
    const targetScale = Math.min(2.5, Math.max(fit.scale, fitScale))

    // Box center offset from transform-origin (image center)
    const dx = centerX * displayWidth - displayWidth / 2
    const dy = centerY * displayHeight - displayHeight / 2

    // Compute translate accounting for rotation.
    // CSS: translate(tx,ty) scale(s) rotate(r) with transform-origin: center
    // A point at offset (dx,dy) from origin is first rotated, then scaled,
    // then translated. We solve for (tx,ty) so the bbox center lands at
    // the container's visual center.
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

    setScale(targetScale)
    setTranslate(newTranslate)
  }, [activeField, validationItems, computeFitView, imageLoaded])

  const boxesWithCoords = validationItems.filter(
    (item) =>
      item.bboxX !== null &&
      item.bboxY !== null &&
      item.bboxWidth !== null &&
      item.bboxHeight !== null &&
      item.status !== 'not_found',
  )

  // Auto-hide overlays when in drawing mode for a clean view
  const effectiveShowOverlays = isDrawing ? false : showOverlays

  return (
    <>
      <div className="relative flex h-full flex-col">
        {/* Placeholder: show local preview while remote loads, with scan overlay when extracting.
            Visible when: scanning OR remote image not yet positioned.
            Fades out smoothly via CSS opacity transition when no longer needed. */}
        {placeholderUrl && !imageError && (
          <div
            className={cn(
              'absolute inset-0 z-10 overflow-hidden rounded-lg border bg-muted bg-[linear-gradient(oklch(0.5_0_0/0.08)_1px,transparent_1px),linear-gradient(90deg,oklch(0.5_0_0/0.08)_1px,transparent_1px)] bg-[length:20px_20px]',
              // Fade OUT smoothly (500ms) but appear instantly (no transition)
              // when !isPositioned. This prevents the user seeing the wrong
              // scale/translate on the image underneath during a slow fade-in.
              isScanning || !isPositioned
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
            {showScanAnim && <ScanAnimation />}
          </div>
        )}
        {/* Drawing mode banner — sits above the image, not overlapping */}
        {isDrawing && drawingFieldName && (
          <div
            className="flex shrink-0 items-center justify-center gap-2 rounded-t-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            role="status"
          >
            {pendingRect ? (
              <>
                Adjust the rectangle, then{' '}
                <button
                  type="button"
                  className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                  onClick={handleConfirmPending}
                >
                  Confirm
                </button>{' '}
                or{' '}
                <button
                  type="button"
                  className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                  onClick={handleRedrawPending}
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
                        {FIELD_DISPLAY_NAMES[drawingFieldName] ??
                          drawingFieldName.replace(/_/g, ' ')}
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
              {pendingRect ? 'to redraw' : 'to cancel'}
            </span>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <ImageViewerContent
            imageUrl={imageUrl}
            boxesWithCoords={boxesWithCoords}
            activeField={activeField}
            onFieldClick={isDrawing ? undefined : onFieldClick}
            showOverlays={effectiveShowOverlays}
            scale={scale}
            translate={translate}
            rotation={rotation}
            isDragging={isDragging}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            containerRef={containerRef}
            isDrawing={isDrawing && !pendingRect}
            hasTopBanner={isDrawing}
            drawingRect={drawingRect}
            pendingRect={pendingRect}
            onPendingMouseDown={handlePendingMouseDown}
            onConfirmPending={handleConfirmPending}
            onRedrawPending={handleRedrawPending}
            annotations={annotations}
            imageError={imageError}
            onImageError={() => setImageError(true)}
            onImageLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
              const img = e.currentTarget
              if (img.naturalWidth && img.naturalHeight) {
                setImageAspect(img.naturalWidth / img.naturalHeight)
              }
              setImageLoaded(true)
            }}
            colorMode={colorMode}
            enableTransition={isPositioned}
          />

          {/* Live crop preview — dynamically positioned to avoid the drawn rectangle */}
          {(() => {
            const previewSource = pendingRect ?? drawingRect
            if (
              !previewSource ||
              previewSource.width < 0.01 ||
              previewSource.height < 0.01
            )
              return null

            // Match the drawn rectangle's aspect ratio using stored image dimensions
            const cropAspect =
              (previewSource.width * imageAspect) / previewSource.height

            // Fit within a max bounding box, preserving aspect ratio
            const MAX_DIM = 220
            const MIN_DIM = 80
            let previewW: number
            let previewH: number
            if (cropAspect >= 1) {
              // Wider than tall
              previewW = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
              previewH = Math.max(MIN_DIM, Math.round(previewW / cropAspect))
            } else {
              // Taller than wide
              previewH = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
              previewW = Math.max(MIN_DIM, Math.round(previewH * cropAspect))
            }

            // Scale the full image so that the crop region fills the preview
            const imgW = previewW / previewSource.width
            const imgH = previewH / previewSource.height

            // Place the preview in the corner furthest from the rectangle's center
            const rectCenterX = previewSource.x + previewSource.width / 2
            const rectCenterY = previewSource.y + previewSource.height / 2
            const placeRight = rectCenterX < 0.5
            const placeBottom = rectCenterY < 0.5

            const positionStyle: React.CSSProperties = {
              width: previewW,
              height: previewH,
              ...(placeRight ? { right: 12 } : { left: 12 }),
              ...(placeBottom ? { bottom: 52 } : { top: 48 }),
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
          })()}

          {/* Controls toolbar */}
          <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-md">
            {/* Toggle overlays */}
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

            {/* Rotate */}
            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={handleRotate}
              aria-label="Rotate 90°"
              title="Rotate 90°"
            >
              <RotateCw className="size-3.5" />
            </button>

            {/* Reset */}
            <button
              type="button"
              className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={handleReset}
              aria-label="Reset view"
              title="Reset view"
            >
              <Home className="size-3.5" />
            </button>

            {/* Expand */}
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

            {/* Zoom controls */}
            <div className="flex items-center text-xs text-muted-foreground">
              <button
                type="button"
                className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                onClick={handleZoomOut}
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="min-w-[3ch] text-center text-[11px] tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                onClick={handleZoomIn}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded lightbox overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={isDrawing ? undefined : handleCollapse}
        >
          <div
            className="relative flex max-h-[85vh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
            style={{ height: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-3 right-3 z-20 flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              onClick={handleCollapse}
              aria-label="Close expanded view"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Image tabs (when multiple images available) */}
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
            {isDrawing && drawingFieldName && (
              <div
                className="flex shrink-0 items-center justify-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                role="status"
              >
                {pendingRect ? (
                  <>
                    Adjust the rectangle, then{' '}
                    <button
                      type="button"
                      className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                      onClick={handleConfirmPending}
                    >
                      Confirm
                    </button>{' '}
                    or{' '}
                    <button
                      type="button"
                      className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
                      onClick={handleRedrawPending}
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
                            {FIELD_DISPLAY_NAMES[drawingFieldName] ??
                              drawingFieldName.replace(/_/g, ' ')}
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
                  {pendingRect ? 'to redraw' : 'to cancel'}
                </span>
              </div>
            )}

            {/* Image viewer fills remaining space */}
            <div className="relative min-h-0 flex-1">
              <ImageViewerContent
                imageUrl={imageUrl}
                boxesWithCoords={boxesWithCoords}
                activeField={activeField}
                onFieldClick={isDrawing ? undefined : onFieldClick}
                showOverlays={effectiveShowOverlays}
                scale={expandedScale}
                translate={expandedTranslate}
                rotation={rotation}
                isDragging={expandedIsDragging}
                onMouseDown={handleExpandedMouseDown}
                onMouseMove={handleExpandedMouseMove}
                onMouseUp={handleExpandedMouseUp}
                onDoubleClick={isDrawing ? () => {} : handleExpandedDoubleClick}
                containerRef={expandedContainerRef}
                isDrawing={isDrawing && !pendingRect}
                drawingRect={drawingRect}
                pendingRect={pendingRect}
                onPendingMouseDown={handlePendingMouseDown}
                onConfirmPending={handleConfirmPending}
                onRedrawPending={handleRedrawPending}
                annotations={annotations}
                colorMode={colorMode}
              />

              {/* Crop preview (expanded view) */}
              {(() => {
                const previewSource = pendingRect ?? drawingRect
                if (
                  !previewSource ||
                  previewSource.width < 0.01 ||
                  previewSource.height < 0.01
                )
                  return null

                const cropAspect =
                  (previewSource.width * imageAspect) / previewSource.height
                const MAX_DIM = 220
                const MIN_DIM = 80
                let previewW: number
                let previewH: number
                if (cropAspect >= 1) {
                  previewW = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
                  previewH = Math.max(
                    MIN_DIM,
                    Math.round(previewW / cropAspect),
                  )
                } else {
                  previewH = Math.min(MAX_DIM, Math.max(MIN_DIM, MAX_DIM))
                  previewW = Math.max(
                    MIN_DIM,
                    Math.round(previewH * cropAspect),
                  )
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
                  ...(placeBottom ? { bottom: 52 } : { top: 12 }),
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
              })()}

              {/* Expanded view controls toolbar */}
              <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
                {/* Toggle overlays */}
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

                {/* Rotate */}
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  onClick={handleRotate}
                  aria-label="Rotate 90°"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>

                {/* Reset */}
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  onClick={() => {
                    setRotation(0)
                    const container = expandedContainerRef.current
                    if (container) {
                      const fit = computeFitView(container)
                      setExpandedScale(fit.scale)
                      setExpandedTranslate({ x: 0, y: fit.translateY })
                    } else {
                      setExpandedScale(1)
                      setExpandedTranslate({ x: 0, y: 0 })
                    }
                  }}
                  aria-label="Reset view"
                  title="Reset view"
                >
                  <Home className="h-3.5 w-3.5" />
                </button>

                {/* Collapse */}
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  onClick={handleCollapse}
                  aria-label="Collapse image"
                  title="Collapse image"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>

                {/* Zoom controls */}
                <div className="flex items-center gap-1 rounded-md bg-background/80 px-1 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
                  <button
                    type="button"
                    className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
                    onClick={handleExpandedZoomOut}
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <span className="min-w-[3ch] text-center tabular-nums">
                    {Math.round(expandedScale * 100)}%
                  </span>
                  <button
                    type="button"
                    className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
                    onClick={handleExpandedZoomIn}
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
