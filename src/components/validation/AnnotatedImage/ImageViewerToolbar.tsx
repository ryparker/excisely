'use client'

import { Eye, EyeOff, Home, Maximize2, Minimize2, RotateCw } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ImageViewerToolbarProps {
  showOverlays: boolean
  onToggleOverlays: () => void
  onRotate: () => void
  onReset: () => void
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  /** 'inline' renders a grouped pill toolbar; 'expanded' renders individual floating buttons */
  variant: 'inline' | 'expanded'
  /** Expand handler (inline only) */
  onExpand?: () => void
  /** Collapse handler (expanded only) */
  onCollapse?: () => void
}

export function ImageViewerToolbar({
  showOverlays,
  onToggleOverlays,
  onRotate,
  onReset,
  scale,
  onZoomIn,
  onZoomOut,
  variant,
  onExpand,
  onCollapse,
}: ImageViewerToolbarProps) {
  const overlayLabel = showOverlays ? 'Hide highlights' : 'Show highlights'
  const OverlayIcon = showOverlays ? Eye : EyeOff

  if (variant === 'expanded') {
    return (
      <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
        <ExpandedButton
          onClick={onToggleOverlays}
          aria-label={overlayLabel}
          title={overlayLabel}
        >
          <OverlayIcon className="h-3.5 w-3.5" />
        </ExpandedButton>

        <ExpandedButton
          onClick={onRotate}
          aria-label="Rotate 90deg"
          title="Rotate 90deg"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </ExpandedButton>

        <ExpandedButton
          onClick={onReset}
          aria-label="Reset view"
          title="Reset view"
        >
          <Home className="h-3.5 w-3.5" />
        </ExpandedButton>

        {onCollapse && (
          <ExpandedButton
            onClick={onCollapse}
            aria-label="Collapse image"
            title="Collapse image"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </ExpandedButton>
        )}

        <div className="flex items-center gap-1 rounded-md bg-background/80 px-1 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
          <button
            type="button"
            className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            &minus;
          </button>
          <span className="min-w-[3ch] text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="rounded px-2 py-1 transition-colors hover:bg-muted active:scale-95"
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-md">
      <InlineButton
        onClick={onToggleOverlays}
        aria-label={overlayLabel}
        title={overlayLabel}
      >
        <OverlayIcon className="size-3.5" />
      </InlineButton>

      <InlineButton
        onClick={onRotate}
        aria-label="Rotate 90deg"
        title="Rotate 90deg"
      >
        <RotateCw className="size-3.5" />
      </InlineButton>

      <InlineButton
        onClick={onReset}
        aria-label="Reset view"
        title="Reset view"
      >
        <Home className="size-3.5" />
      </InlineButton>

      {onExpand && (
        <InlineButton
          onClick={onExpand}
          aria-label="Expand image"
          title="Expand image"
        >
          <Maximize2 className="size-3.5" />
        </InlineButton>
      )}

      <div className="mx-0.5 h-5 w-px bg-border" />

      <div className="flex items-center text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          onClick={onZoomOut}
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="min-w-[3ch] text-center text-[11px] tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          className="rounded-md px-2 py-1 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          onClick={onZoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}

function InlineButton({
  children,
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function ExpandedButton({
  children,
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center rounded-md bg-background/80 p-2.5 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
