'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import type { FileWithPreview } from '@/components/validation/ImageUploadCarousel'
import { MAX_FILE_SIZE } from '@/lib/validators/file-schema'
import { decodeImageDimensions } from '@/lib/validators/decode-image-dimensions'
import { assessImageQuality } from '@/lib/validators/image-quality'

import { ACCEPT_MAP } from './UploadFormConstants'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFileUploadManager() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [uploadingFileIndex, setUploadingFileIndex] = useState<number>(0)

  // Carousel scroll state
  const carouselRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Show camera button only on touch devices (phones/tablets)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    setOrigin(window.location.origin)
  }, [])

  // Camera capture ref
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Carousel scroll handling
  // -------------------------------------------------------------------------

  const updateScrollButtons = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollButtons()
  }, [files.length, updateScrollButtons])

  function scrollCarousel(direction: 'left' | 'right') {
    const el = carouselRef.current
    if (!el) return
    const scrollAmount = el.clientWidth * 0.7
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithPreview[] = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }))
    setFiles((prev) => [...prev, ...newFiles])

    for (let i = 0; i < newFiles.length; i++) {
      const entry = newFiles[i]
      decodeImageDimensions(entry.preview)
        .then(({ width, height }) => {
          const result = assessImageQuality(
            width,
            height,
            entry.file.size,
            entry.file.type,
          )

          if (result.level === 'error') {
            setFiles((prev) => {
              const idx = prev.findIndex((f) => f.preview === entry.preview)
              if (idx === -1) return prev
              URL.revokeObjectURL(entry.preview)
              return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
            })
            toast.error(
              `${entry.file.name} rejected — ${result.issues[0]?.message}`,
            )
          } else if (result.level === 'warning') {
            setFiles((prev) =>
              prev.map((f) =>
                f.preview === entry.preview ? { ...f, quality: result } : f,
              ),
            )
            toast.warning(`${entry.file.name}: ${result.issues[0]?.message}`)
          } else {
            setFiles((prev) =>
              prev.map((f) =>
                f.preview === entry.preview ? { ...f, quality: result } : f,
              ),
            )
          }
        })
        .catch(() => {
          // Could not decode — leave as-is
        })
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev]
      const removed = updated.splice(index, 1)
      if (removed[0]) {
        URL.revokeObjectURL(removed[0].preview)
      }
      return updated
    })
  }, [])

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFileDialog,
  } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    noClick: true,
    onDropRejected: (rejections) => {
      for (const rejection of rejections) {
        const error = rejection.errors[0]
        if (error?.code === 'file-too-large') {
          toast.error(`${rejection.file.name} exceeds the 10 MB limit`)
        } else if (error?.code === 'file-invalid-type') {
          toast.error(`${rejection.file.name} is not a supported image format`)
        } else {
          toast.error(`${rejection.file.name}: ${error?.message}`)
        }
      }
    },
  })

  // Camera capture — opens rear camera on mobile via capture="environment"
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const capturedFiles = e.target.files
      if (capturedFiles?.length) {
        onDrop(Array.from(capturedFiles))
        toast.success('Photo added')
        // Auto-scroll carousel to the "Add more" card so user can easily take another
        setTimeout(() => {
          carouselRef.current?.scrollTo({
            left: carouselRef.current.scrollWidth,
            behavior: 'smooth',
          })
        }, 300)
      }
      // Reset so the same file can be re-captured
      e.target.value = ''
    },
    [onDrop],
  )

  // -------------------------------------------------------------------------
  // Upload files to Vercel Blob
  // -------------------------------------------------------------------------

  async function uploadFiles(): Promise<string[]> {
    const urls: string[] = []

    const updated = [...files]
    for (let i = 0; i < updated.length; i++) {
      const fileEntry = updated[i]
      if (fileEntry.status === 'uploaded' && fileEntry.url) {
        urls.push(fileEntry.url)
        continue
      }

      updated[i] = { ...fileEntry, status: 'uploading' }
      setUploadingFileIndex(i)
      setFiles([...updated])

      try {
        const body = new FormData()
        body.append('file', fileEntry.file)
        const res = await fetch('/api/blob/upload', {
          method: 'POST',
          body,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: 'Upload failed' }))
          throw new Error(data.error ?? `Upload failed (${res.status})`)
        }
        const blob: { url: string } = await res.json()
        updated[i] = { ...fileEntry, status: 'uploaded', url: blob.url }
        urls.push(blob.url)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        updated[i] = { ...fileEntry, status: 'error', error: message }
        setFiles([...updated])
        throw new Error(`Failed to upload ${fileEntry.file.name}: ${message}`)
      }
    }

    setFiles([...updated])
    return urls
  }

  return {
    files,
    setFiles,
    uploadingFileIndex,

    // Carousel
    carouselRef,
    canScrollLeft,
    canScrollRight,
    updateScrollButtons,
    scrollCarousel,

    // Dropzone
    getRootProps,
    getInputProps,
    isDragActive,
    openFileDialog,

    // Camera
    isTouchDevice,
    cameraInputRef,
    openCamera,
    handleCameraCapture,

    // Misc
    origin,
    removeFile,
    uploadFiles,
    addFiles: onDrop,
  }
}
