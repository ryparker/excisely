'use client'

import { AlertTriangle } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/HoverCard'
import type { ImageQualityResult } from '@/lib/validators/image-quality'

export function QualityWarningBadge({
  quality,
}: {
  quality: ImageQualityResult
}) {
  if (quality.level !== 'warning') return null
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="absolute top-1.5 left-1.5 flex size-6 cursor-help items-center justify-center rounded-full bg-amber-500/90 text-white shadow-sm">
          <AlertTriangle className="size-3.5" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-64 p-3">
        <p className="text-[13px] leading-tight font-semibold">
          Image Quality Warning
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {quality.issues[0]?.message ||
            'This image may be too small for accurate text detection.'}
        </p>
        <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground/70">
          For best results, use images at least 500px wide with clear, legible
          text.
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
