'use client'

interface ProcessingStatusBannerProps {
  imageCount?: number
}

export function ProcessingStatusBanner({
  imageCount = 1,
}: ProcessingStatusBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <span className="relative flex size-3 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400/60" />
        <span className="relative inline-flex size-3 rounded-full bg-blue-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">AI Analysis in Progress</p>
        <p className="text-xs text-muted-foreground">
          This typically takes 6&ndash;9 seconds
          {imageCount > 1 && <> &middot; Analyzing {imageCount} images</>}. The
          page will update automatically.
        </p>
      </div>
    </div>
  )
}
