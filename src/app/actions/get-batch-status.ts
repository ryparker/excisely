'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { batches, labels } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchStatusResult {
  id: string
  name: string | null
  status: string
  totalLabels: number
  processedCount: number
  approvedCount: number
  conditionallyApprovedCount: number
  rejectedCount: number
  needsCorrectionCount: number
  labels: Array<{
    id: string
    status: string
    overallConfidence: string | null
  }>
}

type GetBatchStatusResult =
  | { success: true; batch: BatchStatusResult }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function getBatchStatus(
  batchId: string,
): Promise<GetBatchStatusResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    const [batch] = await db
      .select()
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1)

    if (!batch) {
      return { success: false, error: 'Batch not found' }
    }

    const batchLabels = await db
      .select({
        id: labels.id,
        status: labels.status,
        overallConfidence: labels.overallConfidence,
      })
      .from(labels)
      .where(eq(labels.batchId, batchId))

    return {
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        status: batch.status,
        totalLabels: batch.totalLabels,
        processedCount: batch.processedCount,
        approvedCount: batch.approvedCount,
        conditionallyApprovedCount: batch.conditionallyApprovedCount,
        rejectedCount: batch.rejectedCount,
        needsCorrectionCount: batch.needsCorrectionCount,
        labels: batchLabels,
      },
    }
  } catch (error) {
    console.error('[getBatchStatus] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}
