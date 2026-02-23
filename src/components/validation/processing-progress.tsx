'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Progress } from '@/components/ui/progress'
import {
  type ProcessingStage,
  getScaledTimings,
  getTimeEstimateLabel,
} from '@/lib/processing-stages'
import {
  ImageProcessingSummary,
  type ImageInfo,
} from '@/components/validation/image-processing-summary'

// Re-export the type so existing imports from this module still work
export type { ProcessingStage }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProcessingProgressProps {
  /** Current stage the pipeline is in */
  stage: ProcessingStage
  /** Number of images being processed (scales timing estimates) */
  imageCount?: number
  /** Thumbnail data for the image strip */
  images?: ImageInfo[]
  /** Index of the file currently being uploaded */
  uploadingIndex?: number
}

export function ProcessingProgress({
  stage,
  imageCount = 1,
  images,
  uploadingIndex,
}: ProcessingProgressProps) {
  const { stages, totalEstimatedMs } = getScaledTimings(imageCount)
  const currentIdx = stages.findIndex((s) => s.id === stage)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const stageStartRef = useRef<number>(0)

  // Reset stage timer when stage changes
  useEffect(() => {
    stageStartRef.current = performance.now()
  }, [stage])

  // Animate progress smoothly
  useEffect(() => {
    stageStartRef.current = performance.now()
    let raf: number

    function tick() {
      const now = performance.now()

      // Calculate completed stages progress
      let completedMs = 0
      for (let i = 0; i < currentIdx; i++) {
        completedMs += stages[i].estimatedMs
      }

      // Calculate progress within current stage (asymptotic — never reaches 100%)
      const currentStage = stages[currentIdx]
      if (currentStage) {
        const elapsed = now - stageStartRef.current
        // Ease out — approaches but never reaches estimated time
        const stageRatio =
          1 - Math.exp(-elapsed / (currentStage.estimatedMs * 0.6))
        completedMs += currentStage.estimatedMs * stageRatio * 0.95
      }

      const pct = Math.min((completedMs / totalEstimatedMs) * 100, 97)
      setSmoothProgress(pct)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [currentIdx, stages, totalEstimatedMs])

  const headerText =
    imageCount > 1
      ? `Analyzing your ${imageCount} labels`
      : 'Analyzing your label'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg sm:p-8"
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <h3 className="font-heading text-lg font-semibold">{headerText}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This typically takes {getTimeEstimateLabel(imageCount)}
          </p>
        </div>

        {/* Image strip */}
        {images && images.length > 0 && (
          <div className="flex justify-center">
            <ImageProcessingSummary
              images={images}
              activeIndex={stage === 'uploading' ? uploadingIndex : undefined}
            />
          </div>
        )}

        {/* Progress bar */}
        <Progress value={smoothProgress} className="mb-6 h-1.5" />

        {/* Stage list */}
        <div className="space-y-1">
          {stages.map((s, idx) => {
            const isComplete = idx < currentIdx
            const isActive = idx === currentIdx
            const Icon = s.icon

            return (
              <div key={s.id} className="relative">
                <div
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    isActive ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isComplete
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                        : isActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground/50'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {isComplete ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 25,
                          }}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          key="active"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.5,
                            ease: 'easeInOut',
                          }}
                        >
                          <Icon className="size-3.5" />
                        </motion.div>
                      ) : (
                        <Icon className="size-3.5" />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-tight font-medium transition-colors ${
                        isComplete
                          ? 'text-muted-foreground'
                          : isActive
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                      }`}
                    >
                      {s.label}
                      {isComplete && (
                        <span className="ml-1.5 text-xs font-normal text-green-600 dark:text-green-400">
                          Done
                        </span>
                      )}
                    </p>
                    <AnimatePresence>
                      {isActive && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-0.5 text-xs text-muted-foreground"
                        >
                          {s.description(imageCount)}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Active indicator pulse */}
                  {isActive && (
                    <div className="mt-1.5 flex items-center">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
