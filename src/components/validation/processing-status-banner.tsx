'use client'

interface ProcessingStatusBannerProps {
  imageCount?: number
}

function estimateTime(imageCount: number): string {
  // ~12s per image for OCR + classification pipeline
  const low = Math.max(10, imageCount * 10)
  const high = imageCount * 15
  return `${low}\u2013${high} seconds`
}

export function ProcessingStatusBanner({
  imageCount = 1,
}: ProcessingStatusBannerProps) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400/60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
      </span>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Analyzing</span>
        {imageCount > 1 ? ` ${imageCount} images` : ' label'}
        <span className="text-muted-foreground/60">
          {' '}
          &middot; typically {estimateTime(imageCount)} &middot; updates
          automatically
        </span>
      </p>
    </div>
  )
}
