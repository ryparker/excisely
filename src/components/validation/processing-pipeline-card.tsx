'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  getScaledTimings,
  getStageCumulativeDelays,
  getTimeEstimateLabel,
} from '@/lib/processing-stages'

// ---------------------------------------------------------------------------
// sessionStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'excisely:pipeline:'
const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

function getStorageKey(labelId: string) {
  return `${STORAGE_PREFIX}${labelId}`
}

function cleanStaleKeys() {
  const now = Date.now()
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      const stored = Number(sessionStorage.getItem(key))
      if (now - stored > STALE_THRESHOLD_MS) {
        sessionStorage.removeItem(key)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProcessingPipelineCardProps {
  /** Unique label ID — used as sessionStorage key to survive remounts */
  labelId: string
  /** Number of images being processed (scales timing estimates) */
  imageCount?: number
  /** Filenames to display below progress bar */
  imageNames?: string[]
}

export function ProcessingPipelineCard({
  labelId,
  imageCount = 1,
  imageNames,
}: ProcessingPipelineCardProps) {
  const router = useRouter()
  const { stages } = getScaledTimings(imageCount)
  const [activeStage, setActiveStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const stageStartRef = useRef(0)
  const [initialized, setInitialized] = useState(false)

  // Auto-refresh to detect completion (every 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 3000)
    return () => clearInterval(interval)
  }, [router])

  // Resume-aware stage progression via sessionStorage
  useEffect(() => {
    cleanStaleKeys()

    const key = getStorageKey(labelId)
    let startTime = Number(sessionStorage.getItem(key))

    if (!startTime || isNaN(startTime)) {
      startTime = Date.now()
      sessionStorage.setItem(key, String(startTime))
    }

    const elapsed = Date.now() - startTime
    const delays = getStageCumulativeDelays(imageCount)

    // Determine which stage we should be on based on elapsed time
    let resumeStage = 0
    for (let i = delays.length - 1; i >= 0; i--) {
      if (elapsed >= delays[i].delay) {
        resumeStage = i
        break
      }
    }

    setActiveStage(resumeStage)
    stageStartRef.current =
      performance.now() - (elapsed - delays[resumeStage].delay)
    setInitialized(true)

    // Schedule remaining stage transitions
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = resumeStage + 1; i < delays.length; i++) {
      const remainingDelay = delays[i].delay - elapsed
      if (remainingDelay > 0) {
        timers.push(
          setTimeout(() => {
            setActiveStage(i)
            stageStartRef.current = performance.now()
          }, remainingDelay),
        )
      }
    }

    return () => timers.forEach(clearTimeout)
  }, [labelId, imageCount])

  // Smooth progress animation
  useEffect(() => {
    if (!initialized) return

    let raf: number

    function tick() {
      const now = performance.now()
      const elapsed = now - stageStartRef.current

      // Calculate base progress from completed stages
      const stageWeight = 100 / stages.length
      const baseProgress = activeStage * stageWeight

      // Asymptotic progress within current stage
      const stageProgress = stageWeight * (1 - Math.exp(-elapsed / 1500)) * 0.9
      const total = Math.min(baseProgress + stageProgress, 97)

      setProgress(total)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeStage, stages.length, initialized])

  // Don't render until we've determined the resume state
  if (!initialized) return null

  const imageLabel =
    imageNames && imageNames.length > 0
      ? `Analyzing ${imageNames.length} image${imageNames.length > 1 ? 's' : ''}: ${imageNames.join(', ')}`
      : imageCount > 1
        ? `Analyzing ${imageCount} images`
        : undefined

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 font-heading text-base">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400/60" />
            <span className="relative inline-flex size-3 rounded-full bg-blue-500" />
          </span>
          AI Analysis in Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            This typically takes {getTimeEstimateLabel(imageCount)}. The page
            will update automatically when complete.
          </p>
          {imageLabel && (
            <p className="truncate text-xs font-medium text-muted-foreground">
              {imageLabel}
            </p>
          )}
        </div>

        {/* Pipeline stages */}
        <div className="space-y-0.5">
          {stages.map((stage, idx) => {
            const isComplete = idx < activeStage
            const isActive = idx === activeStage
            const Icon = stage.icon

            return (
              <div
                key={stage.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isActive ? 'bg-primary/5' : ''
                }`}
              >
                {/* Step indicator */}
                <div
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isComplete
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                      : isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground/40'
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
                        animate={{ rotate: [0, 8, -8, 0] }}
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

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-tight font-medium transition-colors ${
                      isComplete
                        ? 'text-muted-foreground'
                        : isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground/40'
                    }`}
                  >
                    {stage.label}
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
                        {stage.description(imageCount)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pulse indicator */}
                {isActive && (
                  <div className="mt-1.5">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
