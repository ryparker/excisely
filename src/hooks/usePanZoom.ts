'use client'

import { useCallback, useRef, useState } from 'react'

import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
} from '@/components/validation/AnnotatedImage/image-viewer-constants'

/** Inset (px) matching the placeholder's p-4 so image sits in the same position. */
const FIT_INSET = 16

interface UsePanZoomOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface PanZoomState {
  scale: number
  translate: { x: number; y: number }
  rotation: number
  isDragging: boolean
}

export interface PanZoomActions {
  setScale: React.Dispatch<React.SetStateAction<number>>
  setTranslate: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  setRotation: React.Dispatch<React.SetStateAction<number>>
  zoomIn: () => void
  zoomOut: () => void
  rotate: () => void
  reset: () => void
  computeFitView: (container: HTMLDivElement) => {
    scale: number
    translateY: number
  }
  applyFitView: () => void
  /** Call on mouse down to start a pan drag. Returns false if event was ignored. */
  startDrag: (e: React.MouseEvent) => void
  /** Call on mouse move to continue pan drag. Returns false if not dragging. */
  moveDrag: (e: React.MouseEvent) => boolean
  /** Call on mouse up / mouse leave to end a pan drag. */
  endDrag: () => void
  /** Double-click resets view to fit. */
  handleDoubleClick: () => void
}

export function usePanZoom({
  containerRef,
}: UsePanZoomOptions): PanZoomState & PanZoomActions {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const computeFitView = useCallback(
    (container: HTMLDivElement): { scale: number; translateY: number } => {
      const containerRect = container.getBoundingClientRect()
      const imageEl = container.querySelector('img')
      if (!imageEl) return { scale: 1, translateY: 0 }
      const imageWidth = imageEl.naturalWidth || containerRect.width
      const imageHeight = imageEl.naturalHeight || containerRect.height
      const availableWidth = containerRect.width - FIT_INSET * 2
      const availableHeight = containerRect.height - FIT_INSET * 2
      const displayWidth = containerRect.width
      const displayHeight = (imageHeight / imageWidth) * displayWidth
      const scaleX = availableWidth / displayWidth
      const scaleY = availableHeight / displayHeight
      const fitScale = Math.min(scaleX, scaleY, 1)
      const translateY = (containerRect.height - displayHeight) / 2
      return { scale: fitScale, translateY }
    },
    [],
  )

  const applyFitView = useCallback(() => {
    if (!containerRef.current) return
    const fit = computeFitView(containerRef.current)
    setScale(fit.scale)
    setTranslate({ x: 0, y: fit.translateY })
    setRotation(0)
  }, [containerRef, computeFitView])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP * 3))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP * 3))
  }, [])

  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const reset = useCallback(() => {
    if (containerRef.current) {
      const fit = computeFitView(containerRef.current)
      setScale(fit.scale)
      setTranslate({ x: 0, y: fit.translateY })
    } else {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
    setRotation(0)
  }, [containerRef, computeFitView])

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX - translate.x,
        y: e.clientY - translate.y,
      }
    },
    [translate],
  )

  const moveDrag = useCallback(
    (e: React.MouseEvent): boolean => {
      if (!isDragging) return false
      setTranslate({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      })
      return true
    },
    [isDragging],
  )

  const endDrag = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDoubleClick = reset

  return {
    scale,
    translate,
    rotation,
    isDragging,
    setScale,
    setTranslate,
    setRotation,
    zoomIn,
    zoomOut,
    rotate,
    reset,
    computeFitView,
    applyFitView,
    startDrag,
    moveDrag,
    endDrag,
    handleDoubleClick,
  }
}
