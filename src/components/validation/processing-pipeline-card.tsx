'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  FileSearch,
  ImageUp,
  ScanText,
  Sparkles,
  TextSearch,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------

interface StageConfig {
  id: string
  label: string
  description: string
  icon: typeof ImageUp
}

const STAGES: StageConfig[] = [
  {
    id: 'uploading',
    label: 'Receiving images',
    description: 'Label images stored in secure blob storage',
    icon: ImageUp,
  },
  {
    id: 'ocr',
    label: 'Extracting text (OCR)',
    description: 'Google Cloud Vision reads text and locates bounding boxes',
    icon: ScanText,
  },
  {
    id: 'classifying',
    label: 'Classifying fields',
    description: 'GPT-5 Mini identifies TTB label fields from extracted text',
    icon: Sparkles,
  },
  {
    id: 'comparing',
    label: 'Comparing against application',
    description: 'Matching extracted fields to Form 5100.31 data',
    icon: TextSearch,
  },
  {
    id: 'finalizing',
    label: 'Generating report',
    description: 'Building validation results and determining status',
    icon: FileSearch,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shown on the history/submissions detail page when a label has
 * `status === 'processing'`. Displays an animated pipeline visualization
 * and auto-refreshes to detect when processing completes.
 */
export function ProcessingPipelineCard() {
  const router = useRouter()
  const [activeStage, setActiveStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const stageStartRef = useRef(0)

  // Auto-refresh to detect completion (every 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 3000)
    return () => clearInterval(interval)
  }, [router])

  // Animate through stages on estimated timing
  useEffect(() => {
    const timings = [1500, 2700, 4700, 5300, 5700]
    const timers: ReturnType<typeof setTimeout>[] = []

    for (let i = 0; i < timings.length; i++) {
      timers.push(
        setTimeout(() => {
          setActiveStage(i)
          stageStartRef.current = performance.now()
        }, timings[i]),
      )
    }

    return () => timers.forEach(clearTimeout)
  }, [])

  // Smooth progress animation
  useEffect(() => {
    stageStartRef.current = performance.now()
    let raf: number

    function tick() {
      const now = performance.now()
      const elapsed = now - stageStartRef.current

      // Calculate base progress from completed stages
      const stageWeight = 100 / STAGES.length
      const baseProgress = activeStage * stageWeight

      // Asymptotic progress within current stage
      const stageProgress = stageWeight * (1 - Math.exp(-elapsed / 1500)) * 0.9
      const total = Math.min(baseProgress + stageProgress, 97)

      setProgress(total)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeStage])

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
            This typically takes 3&ndash;5 seconds. The page will update
            automatically when complete.
          </p>
        </div>

        {/* Pipeline stages */}
        <div className="space-y-0.5">
          {STAGES.map((stage, idx) => {
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
                        {stage.description}
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
