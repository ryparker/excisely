'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseImageLoaderOptions {
  imageUrl: string
  isScanning: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Call to fit the image within the container after it loads. */
  applyFitView: () => void
}

export interface ImageLoaderState {
  imageLoaded: boolean
  imageError: boolean
  imageAspect: number
  /** Whether the image has been positioned (centered) after loading. */
  isPositioned: boolean
  /** Delayed scan animation visibility for fade-out. */
  showScanAnim: boolean
}

export interface ImageLoaderActions {
  handleImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  handleImageError: () => void
}

export function useImageLoader({
  imageUrl,
  isScanning,
  containerRef,
  applyFitView,
}: UseImageLoaderOptions): ImageLoaderState & ImageLoaderActions {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageAspect, setImageAspect] = useState(1)

  // Tracks whether the image has been loaded AND positioned (centered).
  // While false, the viewer is hidden (opacity-0) and transitions are disabled
  // so the image doesn't flash at (0,0) then slide to center.
  const [isPositioned, setIsPositioned] = useState(false)
  // Once true, subsequent image switches skip resetting isPositioned so the
  // placeholder overlay doesn't cover bounding boxes while the next image loads.
  const hasBeenPositionedRef = useRef(false)

  // Delayed scan animation visibility -- stays true for 500ms after isScanning
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

  // Reset loaded state when image URL changes (e.g. tab switch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing imageLoaded with imageUrl prop
    setImageLoaded(false)
    setImageError(false)
    // Only hide behind the placeholder overlay on the very first image load.
    if (!hasBeenPositionedRef.current) {
      setIsPositioned(false)
    }
  }, [imageUrl])

  // Check for already-cached images on mount / URL change
  useEffect(() => {
    if (!containerRef.current) return
    const imageEl = containerRef.current.querySelector('img')
    if (imageEl?.complete && imageEl.naturalWidth > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- checking cached image state
      setImageLoaded(true)
    }
  }, [imageUrl, containerRef])

  // Apply fit scale once the image has loaded
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

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      if (img.naturalWidth && img.naturalHeight) {
        setImageAspect(img.naturalWidth / img.naturalHeight)
      }
      setImageLoaded(true)
    },
    [],
  )

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  return {
    imageLoaded,
    imageError,
    imageAspect,
    isPositioned,
    showScanAnim,
    handleImageLoad,
    handleImageError,
  }
}
