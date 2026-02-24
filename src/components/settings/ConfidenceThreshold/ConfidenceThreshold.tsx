'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { updateConfidenceThreshold } from '@/app/actions/update-settings'
import { ThresholdSliderCard } from '@/components/settings/ThresholdSliderCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfidenceThresholdProps {
  defaultValue: number
  avgConfidence: number | null
  avgNotAutoApproved: number | null
}

// ---------------------------------------------------------------------------
// Tick mark on the slider track
// ---------------------------------------------------------------------------

function SliderTick({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-help flex-col items-center"
          style={{ left: `${value}%` }}
        >
          <div
            className="size-2.5 rounded-full border-2 border-white shadow-sm dark:border-zinc-900"
            style={{ backgroundColor: color }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-center">
        <p className="font-medium">{value}%</p>
        <p className="text-[10px] opacity-80">{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfidenceThreshold({
  defaultValue,
  avgConfidence,
  avgNotAutoApproved,
}: ConfidenceThresholdProps) {
  const hasTicks = avgConfidence !== null || avgNotAutoApproved !== null

  return (
    <TooltipProvider>
      <ThresholdSliderCard
        title="Confidence Threshold"
        description="Minimum confidence score (0-100%) for automated approval. Labels below this threshold are flagged for specialist review."
        min={0}
        max={100}
        defaultValue={defaultValue}
        saveAction={updateConfidenceThreshold}
        sliderOverlay={
          hasTicks ? (
            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto relative h-full">
                {avgNotAutoApproved !== null && (
                  <SliderTick
                    value={avgNotAutoApproved}
                    label="Avg. flagged labels"
                    color="var(--color-destructive, #ef4444)"
                  />
                )}
                {avgConfidence !== null && (
                  <SliderTick
                    value={avgConfidence}
                    label="Avg. all labels"
                    color="var(--color-primary, #2563eb)"
                  />
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {hasTicks && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {avgConfidence !== null && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-primary, #2563eb)',
                  }}
                />
                Avg. all labels: {avgConfidence}%
              </span>
            )}
            {avgNotAutoApproved !== null && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-destructive, #ef4444)',
                  }}
                />
                Avg. flagged labels: {avgNotAutoApproved}%
              </span>
            )}
          </div>
        )}
      </ThresholdSliderCard>
    </TooltipProvider>
  )
}
