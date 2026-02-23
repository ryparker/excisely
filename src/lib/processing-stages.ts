import {
  FileSearch,
  ImageUp,
  ScanText,
  Sparkles,
  TextSearch,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProcessingStage =
  | 'uploading'
  | 'ocr'
  | 'classifying'
  | 'comparing'
  | 'finalizing'
  | 'complete'
  | 'timeout'
  | 'error'

export interface StageConfig {
  id: ProcessingStage
  label: string
  description: (imageCount: number) => string
  icon: typeof ImageUp
  /** Base duration estimate in ms (single image) */
  baseEstimatedMs: number
  /** Additional ms per extra image beyond the first */
  perImageMs: number
}

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

export const STAGES: StageConfig[] = [
  {
    id: 'uploading',
    label: 'Uploading images',
    description: (n) =>
      n > 1
        ? `Sending ${n} label images to secure storage`
        : 'Sending label image to secure storage',
    icon: ImageUp,
    baseEstimatedMs: 1200,
    perImageMs: 600,
  },
  {
    id: 'ocr',
    label: 'Reading label text',
    description: (n) =>
      n > 1
        ? `Extracting text from ${n} label images`
        : 'Extracting text from your label',
    icon: ScanText,
    baseEstimatedMs: 1200,
    perImageMs: 200,
  },
  {
    id: 'classifying',
    label: 'Classifying fields',
    description: (n) =>
      n > 1
        ? `Identifying regulatory fields across ${n} images`
        : 'Identifying regulatory fields from extracted text',
    icon: Sparkles,
    baseEstimatedMs: 2000,
    perImageMs: 400,
  },
  {
    id: 'comparing',
    label: 'Comparing against application',
    description: () => 'Matching extracted fields to Form 5100.31 data',
    icon: TextSearch,
    baseEstimatedMs: 600,
    perImageMs: 0,
  },
  {
    id: 'finalizing',
    label: 'Generating report',
    description: () => 'Building validation results and status determination',
    icon: FileSearch,
    baseEstimatedMs: 400,
    perImageMs: 0,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEstimatedMs(stage: StageConfig, imageCount: number): number {
  const extra = Math.max(0, imageCount - 1)
  return stage.baseEstimatedMs + stage.perImageMs * extra
}

/** Returns stage configs with scaled `estimatedMs` and the total estimate. */
export function getScaledTimings(imageCount = 1) {
  const count = Math.max(1, imageCount)
  const stages = STAGES.map((s) => ({
    ...s,
    estimatedMs: getEstimatedMs(s, count),
  }))
  const totalEstimatedMs = stages.reduce((sum, s) => sum + s.estimatedMs, 0)
  return { stages, totalEstimatedMs }
}

/** Returns cumulative delay for each stage transition (when each stage starts). */
export function getStageCumulativeDelays(imageCount = 1) {
  const { stages } = getScaledTimings(imageCount)
  let cumulative = 0
  return stages.map((s) => {
    const delay = cumulative
    cumulative += s.estimatedMs
    return { stageId: s.id, delay }
  })
}

/** Human-readable time estimate string, e.g. "3–5 seconds" */
export function getTimeEstimateLabel(imageCount = 1): string {
  const { totalEstimatedMs } = getScaledTimings(imageCount)
  const lowSec = Math.max(1, Math.floor(totalEstimatedMs / 1000))
  const highSec = Math.ceil(totalEstimatedMs / 1000) + 2
  return `${lowSec}\u2013${highSec} seconds`
}
