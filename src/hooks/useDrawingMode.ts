'use client'

import { useCallback, useEffect, useState } from 'react'

import type { ResizeHandle } from '@/components/validation/AnnotatedImage/image-viewer-constants'
import { screenToNormalizedCoords } from '@/lib/image-coordinates'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface AdjustMode {
  type: 'move' | ResizeHandle
  startMouse: { x: number; y: number }
  startRect: Rect
}

interface UseDrawingModeOptions {
  /** The field currently being drawn (null = not in drawing mode). */
  drawingFieldName: string | null | undefined
  /** Called when the user confirms a drawn rectangle. */
  onDrawingComplete?: (fieldName: string, bbox: Rect) => void
  /** Called when the user cancels drawing via Escape. */
  onDrawingCancel?: () => void
  /** Active container ref for coordinate conversion — switches between inline and expanded. */
  activeContainerRef: React.RefObject<HTMLDivElement | null>
}

export interface DrawingModeState {
  isDrawing: boolean
  drawingRect: Rect | null
  pendingRect: Rect | null
}

export interface DrawingModeActions {
  /**
   * Handle mouse down in drawing mode. Returns true if the event was consumed
   * (the caller should NOT start a pan drag).
   */
  handleDrawMouseDown: (e: React.MouseEvent) => boolean
  /**
   * Handle mouse move in drawing mode. Returns true if the event was consumed
   * (the caller should NOT update pan translation).
   */
  handleDrawMouseMove: (e: React.MouseEvent) => boolean
  /**
   * Handle mouse up in drawing mode. Returns true if the event was consumed.
   */
  handleDrawMouseUp: () => boolean
  /** Start move or resize of pending rect. */
  handlePendingMouseDown: (
    e: React.MouseEvent,
    handle: ResizeHandle | 'move',
  ) => void
  /** Confirm the pending rect and submit the annotation. */
  handleConfirmPending: () => void
  /** Clear pending rect to allow redrawing. */
  handleRedrawPending: () => void
}

export function useDrawingMode({
  drawingFieldName,
  onDrawingComplete,
  onDrawingCancel,
  activeContainerRef,
}: UseDrawingModeOptions): DrawingModeState & DrawingModeActions {
  const isDrawing = !!drawingFieldName

  // Active drawing state
  const [isDrawingActive, setIsDrawingActive] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [drawingRect, setDrawingRect] = useState<Rect | null>(null)

  // Adjustment mode state (pending rect not yet confirmed)
  const [pendingRect, setPendingRect] = useState<Rect | null>(null)
  const [adjustMode, setAdjustMode] = useState<AdjustMode | null>(null)

  // Cancel drawing on Escape (two-level: adjustment -> drawing -> exit)
  useEffect(() => {
    if (!isDrawing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingRect) {
          setPendingRect(null)
          setAdjustMode(null)
        } else {
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

  const handleDrawMouseDown = useCallback(
    (e: React.MouseEvent): boolean => {
      if (!isDrawing) return false

      // Don't start new draw while adjusting pending rect
      if (!pendingRect) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          activeContainerRef.current,
        )
        if (norm) {
          setIsDrawingActive(true)
          setDrawStart(norm)
          setDrawingRect({ x: norm.x, y: norm.y, width: 0, height: 0 })
        }
        return true
      }

      // In adjustment mode, ignore background clicks
      return true
    },
    [isDrawing, pendingRect, activeContainerRef],
  )

  const handleDrawMouseMove = useCallback(
    (e: React.MouseEvent): boolean => {
      // Adjustment mode: move or resize pendingRect
      if (adjustMode && pendingRect) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          activeContainerRef.current,
        )
        if (!norm) return true

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
        return true
      }

      // Active drawing: update drawing rect
      if (isDrawingActive && drawStart) {
        const norm = screenToNormalizedCoords(
          e.clientX,
          e.clientY,
          activeContainerRef.current,
        )
        if (norm) {
          const x = Math.min(drawStart.x, norm.x)
          const y = Math.min(drawStart.y, norm.y)
          const width = Math.abs(norm.x - drawStart.x)
          const height = Math.abs(norm.y - drawStart.y)
          setDrawingRect({ x, y, width, height })
        }
        return true
      }

      return false
    },
    [adjustMode, pendingRect, isDrawingActive, drawStart, activeContainerRef],
  )

  const handleDrawMouseUp = useCallback((): boolean => {
    // End adjustment drag
    if (adjustMode) {
      setAdjustMode(null)
      return true
    }

    if (isDrawingActive && drawingRect && drawingFieldName) {
      // Only register if the rectangle has meaningful size
      if (drawingRect.width > 0.005 && drawingRect.height > 0.005) {
        setPendingRect(drawingRect)
      }
      setIsDrawingActive(false)
      setDrawStart(null)
      setDrawingRect(null)
      return true
    }

    return false
  }, [isDrawingActive, drawingRect, drawingFieldName, adjustMode])

  const handlePendingMouseDown = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle | 'move') => {
      if (!pendingRect) return
      const norm = screenToNormalizedCoords(
        e.clientX,
        e.clientY,
        activeContainerRef.current,
      )
      if (!norm) return
      setAdjustMode({
        type: handle,
        startMouse: norm,
        startRect: { ...pendingRect },
      })
    },
    [pendingRect, activeContainerRef],
  )

  const handleConfirmPending = useCallback(() => {
    if (pendingRect && drawingFieldName) {
      onDrawingComplete?.(drawingFieldName, pendingRect)
    }
    setPendingRect(null)
    setAdjustMode(null)
  }, [pendingRect, drawingFieldName, onDrawingComplete])

  const handleRedrawPending = useCallback(() => {
    setPendingRect(null)
    setAdjustMode(null)
  }, [])

  return {
    isDrawing,
    drawingRect,
    pendingRect,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    handlePendingMouseDown,
    handleConfirmPending,
    handleRedrawPending,
  }
}
