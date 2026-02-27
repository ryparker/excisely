'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle, Clock, X, XCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { type ProcessingStage, getScaledTimings } from '@/lib/processing-stages'
import {
  ImageProcessingSummary,
  type ImageInfo,
} from '@/components/validation/ImageProcessingSummary'

// Re-export the type so existing imports from this module still work
export type { ProcessingStage }

// Terminal stages rendered as final states, not as pipeline steps
const TERMINAL_STAGES = new Set<ProcessingStage>([
  'complete',
  'timeout',
  'error',
])

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
  /** Called when the user dismisses the dialog (X button or backdrop click) */
  onDismiss?: () => void
}

export function ProcessingProgress({
  stage,
  imageCount = 1,
  images,
  uploadingIndex,
  onDismiss,
}: ProcessingProgressProps) {
  const { stages, totalEstimatedMs } = getScaledTimings(imageCount)
  const isTerminal = TERMINAL_STAGES.has(stage)
  const isComplete = stage === 'complete'
  const isTimeout = stage === 'timeout'
  const isError = stage === 'error'
  const isSlow = stage === 'slow'

  const currentIdx = isTerminal
    ? stages.length // all stages "done"
    : isSlow
      ? stages.length - 1 // keep last stage active
      : stages.findIndex((s) => s.id === stage)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const stageStartRef = useRef<number>(0)

  // Live elapsed timer
  const pipelineStartRef = useRef<number>(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    pipelineStartRef.current = performance.now()
  }, [])

  useEffect(() => {
    if (isTimeout || isError) return

    let raf: number
    function tick() {
      const now = performance.now()
      setElapsedMs(now - pipelineStartRef.current)
      if (!isComplete) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isComplete, isTimeout, isError])

  const elapsedDisplay = (elapsedMs / 1000).toFixed(1)

  // Reset stage timer when stage changes
  useEffect(() => {
    stageStartRef.current = performance.now()
  }, [stage])

  // Animate progress smoothly
  useEffect(() => {
    // Terminal: snap to 100% (complete) or freeze (timeout/error)
    if (isComplete) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- terminal animation state
      setSmoothProgress(100)
      return
    }
    if (isTimeout || isError) {
      // Freeze at current value — no further animation
      return
    }

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
  }, [currentIdx, stages, totalEstimatedMs, isComplete, isTimeout, isError])

  // Header text varies by terminal state
  const headerText = isComplete
    ? 'Analysis complete'
    : isTimeout
      ? 'Taking longer than expected'
      : isError
        ? 'Something went wrong'
        : isSlow
          ? 'Almost there'
          : imageCount > 1
            ? `Analyzing your ${imageCount} labels`
            : 'Analyzing your label'

  const HeaderIcon = isComplete
    ? CheckCircle
    : isTimeout
      ? Clock
      : isError
        ? XCircle
        : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      onClick={
        onDismiss
          ? (e) => {
              if (e.target === e.currentTarget) onDismiss()
            }
          : undefined
      }
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-lg sm:p-8"
      >
        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          {HeaderIcon && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="mx-auto mb-2"
            >
              <HeaderIcon
                className={`mx-auto size-8 ${
                  isComplete
                    ? 'text-green-600 dark:text-green-400'
                    : isTimeout
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-destructive'
                }`}
              />
            </motion.div>
          )}
          <h3 className="font-heading text-lg font-semibold">{headerText}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isComplete
              ? 'Your label has been submitted for review'
              : isTimeout
                ? 'Your submission has been saved and will continue processing in the background'
                : isError
                  ? 'Your submission could not be completed. Please try again.'
                  : isSlow
                    ? 'Taking a bit longer than usual — hang tight'
                    : 'This may take a moment'}
          </p>
        </div>

        {/* Image strip — hidden on terminal states */}
        {!isTerminal && images && images.length > 0 && (
          <div className="flex justify-center">
            <ImageProcessingSummary
              images={images}
              activeIndex={stage === 'uploading' ? uploadingIndex : undefined}
            />
          </div>
        )}

        {/* Progress bar + elapsed timer */}
        <div className="mb-6 space-y-1.5">
          <Progress
            value={smoothProgress}
            className={`h-1.5 ${
              isComplete
                ? '[&>div]:bg-green-600 dark:[&>div]:bg-green-400'
                : isTimeout
                  ? '[&>div]:bg-amber-600 dark:[&>div]:bg-amber-400'
                  : isError
                    ? '[&>div]:bg-destructive'
                    : ''
            }`}
          />
          <div className="flex justify-end">
            <span
              className={`font-mono text-xs tabular-nums ${
                isComplete
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground/70'
              }`}
            >
              {elapsedDisplay}s
            </span>
          </div>
        </div>

        {/* Stage list */}
        <div className="space-y-1">
          {stages.map((s, idx) => {
            const stageComplete = idx < currentIdx
            const stageActive = !isTerminal && idx === currentIdx
            const Icon = s.icon

            return (
              <div key={s.id} className="relative">
                <div
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    stageActive ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                      stageComplete
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                        : stageActive
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground/50'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {stageComplete ? (
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
                      ) : stageActive ? (
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
                        stageComplete
                          ? 'text-muted-foreground'
                          : stageActive
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                      }`}
                    >
                      {s.label}
                      {stageComplete && (
                        <span className="ml-1.5 text-xs font-normal text-green-600 dark:text-green-400">
                          Done
                        </span>
                      )}
                    </p>
                    <AnimatePresence>
                      {stageActive && (
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
                  {stageActive && (
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

        {/* Navigate-away hint during processing */}
        {!isTerminal && onDismiss && (
          <p className="mt-4 text-center text-xs text-muted-foreground/70">
            Feel free to navigate away &mdash; your submission will keep
            processing.
          </p>
        )}

        {/* Terminal action buttons */}
        {(isTimeout || isError) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex justify-center"
          >
            <Button
              variant={isTimeout ? 'outline' : 'default'}
              size="sm"
              onClick={onDismiss}
            >
              {isTimeout ? 'Check Later' : 'Close'}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
