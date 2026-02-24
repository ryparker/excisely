'use client'

import { ImagePlus, ScanText, X } from 'lucide-react'
import Image from 'next/image'

import { pluralize } from '@/lib/pluralize'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import type { FileWithPreview } from '@/components/validation/ImageUploadCarousel'

interface PhotoReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: FileWithPreview[]
  imageCountAtLastScan: number
  onRemoveFile: (index: number) => void
  onCancel: () => void
  onAddMore: () => void
  onRescan: () => void
}

export function PhotoReviewDialog({
  open,
  onOpenChange,
  files,
  imageCountAtLastScan,
  onRemoveFile,
  onCancel,
  onAddMore,
  onRescan,
}: PhotoReviewDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel()
        }
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {pluralize(files.length - imageCountAtLastScan, 'new photo')} added
          </DialogTitle>
          <DialogDescription>
            Re-scan to include the new images in your verification, or add more.
          </DialogDescription>
        </DialogHeader>

        {/* All images with remove buttons */}
        <div className="flex flex-wrap gap-2 py-2">
          {files.map((fileEntry, index) => (
            <div
              key={`review-${fileEntry.file.name}-${index}`}
              className="group relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted/20"
            >
              <Image
                src={fileEntry.preview}
                alt={fileEntry.file.name}
                fill
                className="object-cover"
                unoptimized
              />
              {index >= imageCountAtLastScan && (
                <span className="absolute top-0.5 left-0.5 rounded bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  NEW
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  onRemoveFile(index)
                  // Close dialog if all new photos removed
                  if (files.length - 1 <= imageCountAtLastScan) {
                    onOpenChange(false)
                  }
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
                aria-label={`Remove ${fileEntry.file.name}`}
              >
                <X className="size-4 text-white" />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAddMore}>
            <ImagePlus className="size-3.5" />
            Add more
          </Button>
          <Button type="button" size="sm" onClick={onRescan}>
            <ScanText className="size-3.5" />
            Re-scan with {pluralize(files.length, 'image')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
