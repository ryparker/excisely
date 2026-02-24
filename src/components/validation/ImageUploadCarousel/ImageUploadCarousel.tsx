'use client'

import type { RefObject } from 'react'
import { Camera, ImagePlus, Smartphone, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'

import { ScanAnimation } from '@/components/validation/ScanAnimation'
import { cn } from '@/lib/utils'
import type { ImageQualityResult } from '@/lib/validators/image-quality'

import { FileStatusOverlay } from './FileStatusOverlay'
import { QualityWarningBadge } from './QualityWarningBadge'
import { ScrollButtons } from './ScrollButtons'

export interface FileWithPreview {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  url?: string
  error?: string
  quality?: ImageQualityResult
}

interface ImageUploadCarouselProps {
  files: FileWithPreview[]
  mode: 'validate' | 'submit'
  /** 'separate' renders dropzone + grid individually; 'unified' renders merged upload area */
  layout: 'separate' | 'unified'
  isExtracting: boolean
  // Dropzone
  getRootProps: () => Record<string, unknown>
  getInputProps: () => Record<string, unknown>
  isDragActive: boolean
  openFileDialog: () => void
  // Carousel
  carouselRef: RefObject<HTMLDivElement | null>
  canScrollLeft: boolean
  canScrollRight: boolean
  onScroll: () => void
  onScrollCarousel: (direction: 'left' | 'right') => void
  // File actions
  onRemoveFile: (index: number) => void
  // Camera
  isTouchDevice: boolean
  cameraInputRef: RefObject<HTMLInputElement | null>
  onOpenCamera: () => void
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void
  // QR
  origin: string
  onShowQrDialog: () => void
}

export function ImageUploadCarousel({
  files,
  mode,
  layout,
  isExtracting,
  getRootProps,
  getInputProps,
  isDragActive,
  openFileDialog,
  carouselRef,
  canScrollLeft,
  canScrollRight,
  onScroll,
  onScrollCarousel,
  onRemoveFile,
  isTouchDevice,
  cameraInputRef,
  onOpenCamera,
  onCameraCapture,
  origin,
  onShowQrDialog,
}: ImageUploadCarouselProps) {
  const cameraInput = isTouchDevice ? (
    <input
      ref={cameraInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      className="hidden"
      onChange={onCameraCapture}
    />
  ) : null

  const secondaryAction = isTouchDevice ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpenCamera()
      }}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Camera className="size-3.5" />
      Take a photo
    </button>
  ) : origin ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onShowQrDialog()
      }}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <Smartphone className="size-3.5" />
      Take a photo with your phone
    </button>
  ) : null

  if (layout === 'separate') {
    return (
      <>
        {/* Dropzone */}
        <div
          {...getRootProps()}
          onClick={openFileDialog}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            mode === 'submit' && 'p-6',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30',
          )}
        >
          <input {...getInputProps()} />
          {cameraInput}
          <Upload
            className={cn(
              'mx-auto mb-3 text-muted-foreground',
              mode === 'submit' ? 'size-8' : 'size-10',
            )}
          />
          <p className="text-sm font-medium">
            {isDragActive
              ? 'Drop images here...'
              : 'Drag and drop label images, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, or WebP up to 10 MB
          </p>
          {secondaryAction}
        </div>

        {/* Image grid/carousel */}
        {files.length > 0 && (
          <div className="relative">
            <div
              ref={carouselRef}
              onScroll={onScroll}
              className={cn(
                mode === 'submit'
                  ? 'scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2'
                  : 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4',
              )}
            >
              {files.map((fileEntry, index) => (
                <motion.div
                  key={`${fileEntry.file.name}-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border',
                    mode === 'submit'
                      ? 'w-[80%] shrink-0 snap-center sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)]'
                      : '',
                  )}
                >
                  {isExtracting && <ScanAnimation />}
                  <Image
                    src={fileEntry.preview}
                    alt={fileEntry.file.name}
                    width={400}
                    height={mode === 'submit' ? 267 : 200}
                    className={cn(
                      'w-full object-cover',
                      mode === 'submit' ? 'aspect-[3/2]' : 'aspect-square',
                    )}
                    unoptimized
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2.5 pt-5 pb-2">
                    <p className="truncate text-xs font-medium text-white">
                      {fileEntry.file.name}
                    </p>
                    <FileStatusOverlay
                      status={fileEntry.status}
                      error={fileEntry.error}
                    />
                  </div>
                  {fileEntry.quality && (
                    <QualityWarningBadge quality={fileEntry.quality} />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="hover:text-destructive-foreground absolute top-1 right-1 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive active:scale-95"
                    aria-label={`Remove ${fileEntry.file.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Carousel navigation arrows (submit mode only) */}
            {mode === 'submit' && files.length > 1 && (
              <ScrollButtons
                canScrollLeft={canScrollLeft}
                canScrollRight={canScrollRight}
                onScrollCarousel={onScrollCarousel}
              />
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'rounded-xl border-2 border-dashed transition-all',
        isDragActive
          ? 'scale-[1.01] border-primary bg-primary/5'
          : files.length === 0
            ? 'border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30'
            : 'border-muted-foreground/25',
        files.length === 0 && 'cursor-pointer',
      )}
      onClick={files.length === 0 ? openFileDialog : undefined}
    >
      <input {...getInputProps()} />
      {cameraInput}
      {files.length === 0 ? (
        <div className="flex min-h-[34rem] flex-col gap-5 p-5">
          {/* Ghost placeholder cards */}
          <div className="flex flex-1 gap-3">
            <div className="group/front flex w-full flex-1 flex-col pb-1 sm:w-1/2 md:w-1/3 md:flex-none">
              <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out group-hover/front:-translate-y-1 group-hover/front:border-primary/40 group-hover/front:bg-primary/[0.04] group-hover/front:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60 transition-[background-color] duration-200 ease-out group-hover/front:bg-primary/15">
                  <ImagePlus className="size-5 text-muted-foreground/40 transition-[color] duration-200 ease-out group-hover/front:text-primary/70" />
                </div>
                <span className="text-xs font-medium text-muted-foreground/40 transition-[color] duration-200 ease-out group-hover/front:text-primary/70">
                  Front label
                </span>
              </div>
            </div>
            <div className="group/back hidden flex-1 flex-col pb-1 sm:flex sm:w-1/2 md:w-1/3 md:flex-none">
              <div className="flex min-h-44 flex-1 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-muted-foreground/15 bg-muted/5 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out group-hover/back:-translate-y-1 group-hover/back:border-primary/40 group-hover/back:bg-primary/[0.04] group-hover/back:shadow-md">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/40 transition-[background-color] duration-200 ease-out group-hover/back:bg-primary/15">
                  <ImagePlus className="size-5 text-muted-foreground/25 transition-[color] duration-200 ease-out group-hover/back:text-primary/70" />
                </div>
                <span className="text-xs font-medium text-muted-foreground/25 transition-[color] duration-200 ease-out group-hover/back:text-primary/70">
                  Back label
                </span>
              </div>
            </div>
          </div>
          {/* Upload instructions */}
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop images here...'
                : 'Drag and drop label images, or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP up to 10 MB
            </p>
            {isTouchDevice ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenCamera()
                }}
                className="mt-1 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Camera className="size-3.5" />
                Take a photo
              </button>
            ) : (
              origin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onShowQrDialog()
                  }}
                  className="mt-1 flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Smartphone className="size-3.5" />
                  Take a photo with your phone
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="relative">
            <div
              ref={carouselRef}
              onScroll={onScroll}
              className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
            >
              <AnimatePresence>
                {files.map((fileEntry, index) => (
                  <motion.div
                    key={`${fileEntry.file.name}-${index}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative h-[31rem] w-[75%] shrink-0 snap-center overflow-hidden rounded-xl border bg-muted/20 sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)]"
                  >
                    {isExtracting && <ScanAnimation />}
                    <Image
                      src={fileEntry.preview}
                      alt={fileEntry.file.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2.5 pt-5 pb-2">
                      <p className="truncate text-xs font-medium text-white">
                        {fileEntry.file.name}
                      </p>
                      <FileStatusOverlay
                        status={fileEntry.status}
                        error={fileEntry.error}
                      />
                    </div>
                    {fileEntry.quality && (
                      <QualityWarningBadge quality={fileEntry.quality} />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile(index)
                      }}
                      className="hover:text-destructive-foreground absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-destructive active:scale-95"
                      aria-label={`Remove ${fileEntry.file.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add more card */}
              <div className="flex h-[31rem] w-[75%] shrink-0 snap-center flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/10 sm:w-[calc(50%-0.375rem)] md:w-[calc(33.333%-0.5rem)]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openFileDialog()
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Upload className="size-4" />
                  {isTouchDevice ? 'Browse files' : 'Add more'}
                </button>
                {isTouchDevice ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenCamera()
                    }}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Camera className="size-4" />
                    Take a photo
                  </button>
                ) : (
                  origin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowQrDialog()
                      }}
                      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Smartphone className="size-4" />
                      Use your phone
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Carousel arrows */}
            {files.length > 1 && (
              <ScrollButtons
                canScrollLeft={canScrollLeft}
                canScrollRight={canScrollRight}
                onScrollCarousel={onScrollCarousel}
                stopPropagation
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
