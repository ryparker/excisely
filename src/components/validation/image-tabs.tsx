'use client'

import { ImageIcon } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

const IMAGE_TYPE_LABELS: Record<string, string> = {
  front: 'Front',
  back: 'Back',
  neck: 'Neck',
  strip: 'Strip',
  other: 'Other',
}

interface ImageTabsProps {
  /** Images with browser-ready URLs (already signed if needed). */
  images: Array<{ id: string; imageUrl: string; imageType: string }>
  selectedImageId: string
  onSelect: (imageId: string) => void
}

export function ImageTabs({
  images,
  selectedImageId,
  onSelect,
}: ImageTabsProps) {
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())

  if (images.length <= 1) return null

  return (
    <div className="mb-2 flex gap-1.5">
      {images.map((img) => {
        const isActive = img.id === selectedImageId
        const failed = failedIds.has(img.id)
        const label = IMAGE_TYPE_LABELS[img.imageType] ?? img.imageType
        return (
          <button
            key={img.id}
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
              isActive
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-muted/40 opacity-75 hover:opacity-100',
            )}
            onClick={() => onSelect(img.id)}
          >
            <span className="inline-block h-8 w-12 shrink-0 overflow-hidden rounded bg-muted/80">
              {failed ? (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                  <ImageIcon className="size-3.5" />
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() =>
                    setFailedIds((prev) => new Set(prev).add(img.id))
                  }
                />
              )}
            </span>
            <span
              className={cn(
                'text-xs font-medium',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
