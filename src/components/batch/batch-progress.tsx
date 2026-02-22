'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react'

import {
  getBatchStatus,
  type BatchStatusResult,
} from '@/app/actions/get-batch-status'
import { processBatchItem } from '@/app/actions/process-batch-item'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000
const PROCESS_CONCURRENCY = 2

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BatchProgressProps {
  batchId: string
  initialBatch: BatchStatusResult
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchProgress({ batchId, initialBatch }: BatchProgressProps) {
  const router = useRouter()
  const [batch, setBatch] = useState<BatchStatusResult>(initialBatch)
  const processingStartedRef = useRef(false)

  const isComplete = batch.status === 'completed' || batch.status === 'failed'
  const progressPercent =
    batch.totalLabels > 0
      ? Math.round((batch.processedCount / batch.totalLabels) * 100)
      : 0

  // -------------------------------------------------------------------------
  // Start processing pending labels
  // -------------------------------------------------------------------------

  const processLabels = useCallback(async () => {
    if (processingStartedRef.current) return
    processingStartedRef.current = true

    try {
      // Find pending labels from the initial batch data
      const pendingLabels = batch.labels
        .filter((l) => l.status === 'pending')
        .map((l) => l.id)

      // Process labels with limited concurrency
      const queue = [...pendingLabels]
      const active = new Set<Promise<void>>()

      while (queue.length > 0 || active.size > 0) {
        while (queue.length > 0 && active.size < PROCESS_CONCURRENCY) {
          const labelId = queue.shift()!
          const promise = processBatchItem(labelId)
            .then(() => {
              active.delete(promise as unknown as Promise<void>)
            })
            .catch((err) => {
              console.error(`[BatchProgress] Error processing ${labelId}:`, err)
              active.delete(promise as unknown as Promise<void>)
            })
          active.add(promise as unknown as Promise<void>)
        }

        if (active.size > 0) {
          await Promise.race(active)
        }
      }
    } catch (err) {
      console.error('[BatchProgress] Processing error:', err)
    }
  }, [batch.labels])

  // -------------------------------------------------------------------------
  // Poll for status updates
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Start processing immediately
    processLabels()
  }, [processLabels])

  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(async () => {
      const result = await getBatchStatus(batchId)
      if (result.success) {
        setBatch(result.batch)

        if (
          result.batch.status === 'completed' ||
          result.batch.status === 'failed'
        ) {
          clearInterval(interval)
          // Refresh page to show final server-rendered state
          router.refresh()
        }
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [batchId, isComplete, router])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between pb-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              {!isComplete && <Loader2 className="size-4 animate-spin" />}
              {isComplete
                ? `${batch.processedCount} of ${batch.totalLabels} labels processed`
                : `Processing ${batch.processedCount} of ${batch.totalLabels} labels...`}
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.totalLabels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle className="size-4" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.approvedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="size-4" />
              Conditionally Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batch.conditionallyApprovedCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
              <Clock className="size-4" />
              Needs Correction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batch.needsCorrectionCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <XCircle className="size-4" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batch.rejectedCount}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
