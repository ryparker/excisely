'use client'

import { useCallback, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

const STATUS_COLORS: Record<string, { stroke: string; fill: string }> = {
  match: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)' },
  mismatch: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)' },
  needs_correction: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.1)' },
}

const ACTIVE_STATUS_COLORS: Record<string, { stroke: string; fill: string }> = {
  match: { stroke: '#16a34a', fill: 'rgba(34, 197, 94, 0.2)' },
  mismatch: { stroke: '#dc2626', fill: 'rgba(239, 68, 68, 0.2)' },
  needs_correction: { stroke: '#d97706', fill: 'rgba(245, 158, 11, 0.2)' },
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning',
  name_and_address: 'Name & Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Decl.',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Dist.',
  standards_of_fill: 'Standards of Fill',
}

interface ValidationItemBox {
  fieldName: string
  status: string
  bboxX: number | null
  bboxY: number | null
  bboxWidth: number | null
  bboxHeight: number | null
}

interface AnnotatedImageProps {
  imageUrl: string
  validationItems: ValidationItemBox[]
  activeField?: string | null
}

export function AnnotatedImage({
  imageUrl,
  validationItems,
  activeField,
}: AnnotatedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setScale((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)))
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y })
    },
    [translate],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDoubleClick = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    },
    [],
  )

  const boxesWithCoords = validationItems.filter(
    (item) =>
      item.bboxX !== null &&
      item.bboxY !== null &&
      item.bboxWidth !== null &&
      item.bboxHeight !== null &&
      item.status !== 'not_found',
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-muted',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="relative origin-center transition-transform duration-75"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Label image"
          className="block h-auto w-full"
          draggable={false}
          onLoad={handleImageLoad}
        />

        {imageDimensions.width > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {boxesWithCoords.map((item) => {
              const isActive = activeField === item.fieldName
              const colors = isActive
                ? (ACTIVE_STATUS_COLORS[item.status] ??
                  ACTIVE_STATUS_COLORS.match)
                : (STATUS_COLORS[item.status] ?? STATUS_COLORS.match)
              const strokeWidth = isActive ? 4 : 2
              const label =
                FIELD_DISPLAY_NAMES[item.fieldName] ??
                item.fieldName.replace(/_/g, ' ')

              return (
                <g key={item.fieldName}>
                  <rect
                    x={Number(item.bboxX)}
                    y={Number(item.bboxY)}
                    width={Number(item.bboxWidth)}
                    height={Number(item.bboxHeight)}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={strokeWidth}
                    rx={2}
                  />
                  <text
                    x={Number(item.bboxX) + 4}
                    y={Number(item.bboxY) - 6}
                    fill={colors.stroke}
                    fontSize={14}
                    fontWeight={isActive ? 700 : 500}
                    fontFamily="system-ui, sans-serif"
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Zoom indicator */}
      <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {Math.round(scale * 100)}%
      </div>
    </div>
  )
}
