'use server'

import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import pLimit from 'p-limit'

import { db } from '@/db'
import {
  labels,
  statusOverrides,
  validationItems,
  validationResults,
} from '@/db/schema'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { getApprovalThreshold } from '@/lib/settings/get-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchApproveResult {
  success: boolean
  approvedCount: number
  failedIds: string[]
  error?: string
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function batchApprove(
  labelIds: string[],
): Promise<BatchApproveResult> {
  // 1. Auth — specialist only
  const guard = await guardSpecialist()
  if (!guard.success) return { ...guard, approvedCount: 0, failedIds: [] }
  const { session } = guard

  // 2. Validate input
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    return {
      success: false,
      approvedCount: 0,
      failedIds: [],
      error: 'No labels provided',
    }
  }
  if (labelIds.length > 100) {
    return {
      success: false,
      approvedCount: 0,
      failedIds: [],
      error: 'Maximum 100 labels per batch',
    }
  }

  const threshold = await getApprovalThreshold()
  const limit = pLimit(5)
  const failedIds: string[] = []
  let approvedCount = 0

  await Promise.all(
    labelIds.map((labelId) =>
      limit(async () => {
        try {
          // Fetch the label
          const [label] = await db
            .select({
              id: labels.id,
              status: labels.status,
              aiProposedStatus: labels.aiProposedStatus,
              overallConfidence: labels.overallConfidence,
            })
            .from(labels)
            .where(eq(labels.id, labelId))
            .limit(1)

          if (!label) {
            failedIds.push(labelId)
            return
          }

          // Verify: must be pending_review
          if (label.status !== 'pending_review') {
            failedIds.push(labelId)
            return
          }

          // Verify: confidence meets threshold
          const confidence = label.overallConfidence
            ? Number(label.overallConfidence)
            : 0
          if (confidence < threshold) {
            failedIds.push(labelId)
            return
          }

          // Verify: all validation items are match
          const [currentResult] = await db
            .select({ id: validationResults.id })
            .from(validationResults)
            .where(
              and(
                eq(validationResults.labelId, labelId),
                eq(validationResults.isCurrent, true),
              ),
            )
            .limit(1)

          if (!currentResult) {
            failedIds.push(labelId)
            return
          }

          const items = await db
            .select({ status: validationItems.status })
            .from(validationItems)
            .where(eq(validationItems.validationResultId, currentResult.id))

          const allMatch =
            items.length > 0 && items.every((i) => i.status === 'match')
          if (!allMatch) {
            failedIds.push(labelId)
            return
          }

          // Create status override record for audit trail
          await db.insert(statusOverrides).values({
            labelId,
            specialistId: session.user.id,
            previousStatus: 'pending_review',
            newStatus: 'approved',
            justification:
              'Batch approved — all fields verified by AI with high confidence',
            reasonCode: 'batch_approved',
          })

          // Update label status
          await db
            .update(labels)
            .set({ status: 'approved' })
            .where(eq(labels.id, labelId))

          approvedCount++
        } catch (error) {
          console.error(`[batchApprove] Failed for label ${labelId}:`, error)
          failedIds.push(labelId)
        }
      }),
    ),
  )

  revalidatePath('/')

  return {
    success: failedIds.length === 0,
    approvedCount,
    failedIds,
  }
}
