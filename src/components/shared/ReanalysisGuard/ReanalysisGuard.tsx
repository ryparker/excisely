'use client'

import type { ReactNode } from 'react'

import { useReanalysisStore } from '@/stores/useReanalysisStore'

interface ReanalysisGuardProps {
  labelId: string
  labelStatus: string
  /** Content to show while processing/reanalyzing */
  processingContent: ReactNode
  /** Content to show when not processing */
  normalContent: ReactNode
}

/**
 * Thin client wrapper that switches between processing and normal views.
 * Uses the Zustand store to detect client-initiated reanalysis, and falls
 * back to the server-provided label status for SSR / initial load.
 */
export function ReanalysisGuard({
  labelId,
  labelStatus,
  processingContent,
  normalContent,
}: ReanalysisGuardProps) {
  const isReanalyzing = useReanalysisStore((s) => s.activeIds.has(labelId))
  const isProcessing = labelStatus === 'pending' || labelStatus === 'processing'

  if (isProcessing || isReanalyzing) {
    return <div className="space-y-5">{processingContent}</div>
  }

  return <div className="space-y-5">{normalContent}</div>
}
