'use client'

import { useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertTriangle, ImagePlus, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ACCEPT_MAP } from '@/components/validation/LabelUploadForm/UploadFormConstants'
import { useBatchUploadStore } from '@/stores/useBatchUploadStore'

export function BatchImageUploader() {
  const { imageFiles, rows, addImageFiles, removeImageFile } =
    useBatchUploadStore()

  const onDrop = useCallback(
    (accepted: File[]) => {
      addImageFiles(accepted)
    },
    [addImageFiles],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_MAP,
    multiple: true,
  })

  // Compute which images are referenced by CSV rows
  const referencedFilenames = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      for (const f of row.imageFilenames) {
        set.add(f)
      }
    }
    return set
  }, [rows])

  // Images referenced in CSV but not yet uploaded
  const missingImages = useMemo(() => {
    const missing: string[] = []
    for (const filename of referencedFilenames) {
      if (!imageFiles.has(filename)) {
        missing.push(filename)
      }
    }
    return missing
  }, [referencedFilenames, imageFiles])

  // Images uploaded but not referenced by any CSV row
  const orphanedImages = useMemo(() => {
    const orphaned: string[] = []
    for (const filename of imageFiles.keys()) {
      if (!referencedFilenames.has(filename)) {
        orphaned.push(filename)
      }
    }
    return orphaned
  }, [referencedFilenames, imageFiles])

  const uploadedNames = Array.from(imageFiles.keys())

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background tabular-nums">
            2
          </span>
          <h3 className="text-[13px] font-semibold">Label Images</h3>
        </div>
        {uploadedNames.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {uploadedNames.length}{' '}
            {uploadedNames.length === 1 ? 'image' : 'images'}
          </span>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`group flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 transition-[border-color,background-color,box-shadow] duration-200 ease-out ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : uploadedNames.length > 0
              ? 'border-primary/40 bg-primary/[0.03]'
              : 'border-muted-foreground/20 bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60 transition-shadow duration-200 group-hover:shadow">
            <ImagePlus className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragActive
                ? 'Drop images here'
                : 'Drop label images or click to browse'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              JPG, PNG, or WebP — filenames must match CSV
            </p>
          </div>
        </div>
      </div>

      {/* Uploaded file list */}
      {uploadedNames.length > 0 && (
        <ul className="space-y-1">
          {uploadedNames.map((name) => {
            const isOrphaned = orphanedImages.includes(name)
            return (
              <li
                key={name}
                className={`flex min-h-[44px] items-center justify-between rounded-md px-2.5 py-2 text-sm ${
                  isOrphaned
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-muted/50'
                }`}
              >
                <span className="min-w-0 truncate">{name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeImageFile(name)
                  }}
                  aria-label={`Remove ${name}`}
                >
                  <X className="size-3" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Orphaned images warning */}
      {orphanedImages.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {orphanedImages.length}{' '}
            {orphanedImages.length === 1 ? 'image is' : 'images are'} not
            referenced by any CSV row
          </span>
        </div>
      )}

      {/* Missing images warning */}
      {missingImages.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>
              {missingImages.length}{' '}
              {missingImages.length === 1 ? 'image' : 'images'} referenced in
              CSV but not uploaded:
            </p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {missingImages.slice(0, 5).map((name) => (
                <li key={name}>{name}</li>
              ))}
              {missingImages.length > 5 && (
                <li>and {missingImages.length - 5} more...</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
