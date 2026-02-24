'use client'

import { useState, useCallback, useRef } from 'react'
import { FileText } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

interface LabelThumbnailProps {
  src: string | null
  alt: string
  size?: string
}

export function LabelThumbnail({
  src,
  alt,
  size = 'size-12',
}: LabelThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const onError = useCallback(() => setFailed(true), [])
  const openTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [open, setOpen] = useState(false)

  const showImage = src && !failed

  const thumbnail = (
    <div className={`${size} overflow-hidden rounded-lg border bg-muted`}>
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          onError={onError}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/30">
          <FileText className="size-5" />
        </div>
      )}
    </div>
  )

  if (!showImage) return thumbnail

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={300}
      closeDelay={0}
    >
      <HoverCardTrigger
        asChild
        onMouseEnter={() => {
          openTimerRef.current = setTimeout(() => setOpen(true), 300)
        }}
        onMouseLeave={() => {
          if (openTimerRef.current) clearTimeout(openTimerRef.current)
          setOpen(false)
        }}
      >
        {thumbnail}
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-auto p-1"
        onMouseEnter={() => setOpen(false)}
        onPointerDownOutside={() => setOpen(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-72 max-w-64 rounded object-contain"
        />
      </HoverCardContent>
    </HoverCard>
  )
}
