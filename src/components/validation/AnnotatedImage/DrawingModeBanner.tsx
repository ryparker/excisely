'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { formatFieldName } from '@/config/field-display-names'
import { FIELD_TOOLTIPS } from '@/config/field-tooltips'
import { cn } from '@/lib/utils'

interface DrawingModeBannerProps {
  drawingFieldName: string
  pendingRect: { x: number; y: number; width: number; height: number } | null
  onConfirmPending: () => void
  onRedrawPending: () => void
  /** Apply rounded top corners (used for inline view, not expanded lightbox) */
  roundedTop?: boolean
}

export function DrawingModeBanner({
  drawingFieldName,
  pendingRect,
  onConfirmPending,
  onRedrawPending,
  roundedTop = false,
}: DrawingModeBannerProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-medium text-white',
        roundedTop && 'rounded-t-lg',
      )}
      role="status"
    >
      {pendingRect ? (
        <>
          Adjust the rectangle, then{' '}
          <button
            type="button"
            className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
            onClick={onConfirmPending}
          >
            Confirm
          </button>{' '}
          or{' '}
          <button
            type="button"
            className="rounded bg-white/20 px-1.5 py-0.5 font-semibold transition-colors hover:bg-white/30 active:scale-95"
            onClick={onRedrawPending}
          >
            Redraw
          </button>
        </>
      ) : (
        <>
          Draw a rectangle around{' '}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <strong className="cursor-help border-b border-dashed border-white/40">
                  {formatFieldName(drawingFieldName)}
                </strong>
              </TooltipTrigger>
              {FIELD_TOOLTIPS[drawingFieldName] && (
                <TooltipContent side="bottom" className="max-w-xs">
                  {FIELD_TOOLTIPS[drawingFieldName].description}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </>
      )}
      <kbd className="ml-1 rounded border border-indigo-400/50 bg-indigo-500/50 px-1.5 py-0.5 font-mono text-xs text-indigo-100">
        Esc
      </kbd>
      <span className="text-indigo-200">
        {pendingRect ? 'to redraw' : 'to cancel'}
      </span>
    </div>
  )
}
