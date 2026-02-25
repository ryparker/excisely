'use client'

import { Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { formatFieldName } from '@/config/field-display-names'
import {
  VALIDATION_BADGE_LABEL,
  VALIDATION_BADGE_STYLE,
  VALIDATION_BOX_ACTIVE_COLORS,
  VALIDATION_BOX_COLORS,
} from '@/config/validation-item-config'
import { cn } from '@/lib/utils'
import {
  HANDLE_CURSORS,
  HANDLE_POSITIONS,
  NEUTRAL_ACTIVE_COLORS,
  NEUTRAL_COLORS,
  type ResizeHandle,
} from '@/components/validation/AnnotatedImage/image-viewer-constants'
import type {
  SpecialistAnnotation,
  ValidationItemBox,
} from '@/components/validation/AnnotatedImage/AnnotatedImageTypes'

export interface ImageViewerContentProps {
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
}

/** Shared image content: pannable/zoomable image with optional bounding box overlays */
export function ImageViewerContent({
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
}: ImageViewerContentProps) {
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full overflow-hidden border bg-muted bg-[linear-gradient(oklch(0.5_0_0/0.04)_1px,transparent_1px),linear-gradient(90deg,oklch(0.5_0_0/0.04)_1px,transparent_1px)] bg-[length:20px_20px]',
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
          enableTransition &&
            !isDragging &&
            'transition-transform duration-300 ease-out',
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
                item.status in VALIDATION_BOX_COLORS ? item.status : 'match'
              const colors = isNeutral
                ? NEUTRAL_COLORS
                : VALIDATION_BOX_COLORS[statusKey]
              const activeColors = isNeutral
                ? NEUTRAL_ACTIVE_COLORS
                : VALIDATION_BOX_ACTIVE_COLORS[statusKey]
              const label = formatFieldName(item.fieldName)
              const confidencePercent = Math.round(item.confidence)
              const statusLabel = isNeutral
                ? 'Detected'
                : (VALIDATION_BADGE_LABEL[item.status] ??
                  item.status.charAt(0).toUpperCase() + item.status.slice(1))

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
                        left: `calc(${Number(item.bboxX) * 100}% - 2px)`,
                        top: `calc(${Number(item.bboxY) * 100}% - 2px)`,
                        width: `calc(${Number(item.bboxWidth) * 100}% + 4px)`,
                        height: `calc(${Number(item.bboxHeight) * 100}% + 4px)`,
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
                              VALIDATION_BADGE_STYLE[item.status] ?? '',
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
