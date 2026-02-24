'use client'

import { ImageIcon } from 'lucide-react'
import { motion } from 'motion/react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageInfo {
  name: string
  thumbnailUrl?: string
}

interface ImageProcessingSummaryProps {
  images: ImageInfo[]
  /** Index of the image currently being uploaded (undefined = not in upload stage) */
  activeIndex?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 5

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageProcessingSummary({
  images,
  activeIndex,
}: ImageProcessingSummaryProps) {
  if (images.length === 0) return null

  const visible = images.slice(0, MAX_VISIBLE)
  const remaining = images.length - MAX_VISIBLE

  return (
    <div className="mb-4 flex items-center gap-3">
      {/* Overlapping thumbnail strip */}
      <div className="flex -space-x-2">
        {visible.map((img, idx) => {
          const isActive = activeIndex === idx

          return (
            <motion.div
              key={`${img.name}-${idx}`}
              initial={{ opacity: 0, scale: 0.8, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 25,
                delay: idx * 0.06,
              }}
              className={`relative size-8 shrink-0 overflow-hidden rounded-md border-2 bg-muted ${
                isActive
                  ? 'z-10 border-primary ring-2 ring-primary/30'
                  : 'border-background'
              }`}
              style={{ zIndex: isActive ? 10 : MAX_VISIBLE - idx }}
            >
              {img.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.thumbnailUrl}
                  alt={img.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <ImageIcon className="size-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          )
        })}
        {remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: MAX_VISIBLE * 0.06 }}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border-2 border-background bg-muted text-xs font-medium text-muted-foreground"
            style={{ zIndex: 0 }}
          >
            +{remaining}
          </motion.div>
        )}
      </div>

      {/* Label */}
      <p className="min-w-0 truncate text-xs text-muted-foreground">
        {images.length === 1 ? images[0].name : `${images.length} images`}
      </p>
    </div>
  )
}
