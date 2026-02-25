'use server'

import { updateTag } from 'next/cache'

import {
  getLabelById,
  getLabelAppData,
  getLabelImages,
} from '@/db/queries/labels'
import { getCurrentValidationResult } from '@/db/queries/validation'
import { updateLabelStatus } from '@/db/mutations/labels'
import { supersedeValidationResult } from '@/db/mutations/validation'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { logActionError } from '@/lib/actions/action-error'
import { addDays, buildExpectedFields } from '@/lib/labels/validation-helpers'
import { runValidationPipeline } from '@/lib/actions/validation-pipeline'
import type { ActionResult } from '@/lib/actions/result-types'

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function reanalyzeLabel(
  labelId: string,
): Promise<ActionResult<{ labelId: string }>> {
  // 1. Auth check — specialist only
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  // 2. Fetch the label
  const label = await getLabelById(labelId)

  if (!label) {
    return { success: false, error: 'Label not found' }
  }

  if (label.status === 'processing') {
    // If stuck in processing for >5 min, the previous pipeline likely crashed.
    // Allow re-processing so labels don't get permanently stuck.
    const STALE_PROCESSING_MS = 5 * 60 * 1000
    const age = Date.now() - label.updatedAt.getTime()
    if (age < STALE_PROCESSING_MS) {
      return { success: false, error: 'Label is already being processed' }
    }
  }

  // 3. Save original status for error recovery.
  //    For stale processing labels we don't know the pre-crash status,
  //    so fall back to 'pending_review' which keeps it in the specialist queue.
  const originalStatus =
    label.status === 'processing' ? 'pending_review' : label.status

  try {
    // 4. Set label to processing (optimistic lock)
    await updateLabelStatus(labelId, { status: 'processing' })

    // 5. Fetch existing application data and images
    const [appData, images] = await Promise.all([
      getLabelAppData(labelId),
      getLabelImages(labelId),
    ])

    if (!appData) {
      throw new Error('Application data not found for this label')
    }
    if (images.length === 0) {
      throw new Error('No label images found')
    }

    const imageUrls = images.map((img) => img.imageUrl)

    // 6. Run shared AI validation pipeline
    const expectedFields = buildExpectedFields(appData, label.beverageType)
    const result = await runValidationPipeline({
      labelId,
      imageUrls,
      imageRecordIds: images.map((img) => img.id),
      beverageType: label.beverageType,
      containerSizeMl: label.containerSizeMl,
      expectedFields,
    })

    // 7. Supersede old validation result
    const currentResult = await getCurrentValidationResult(labelId)
    if (currentResult) {
      await supersedeValidationResult(
        currentResult.id,
        result.validationResultId,
      )
    }

    // 8. Update label with final status (includes deadline computation)
    await updateLabelStatus(labelId, {
      status: 'pending_review',
      aiProposedStatus: result.overallStatus,
      overallConfidence: String(result.overallConfidence),
      correctionDeadline: result.deadlineDays
        ? addDays(new Date(), result.deadlineDays)
        : null,
      deadlineExpired: false,
    })

    updateTag('labels')
    updateTag('sla-metrics')

    return { success: true, labelId }
  } catch (error) {
    // Error recovery: restore original status
    try {
      await updateLabelStatus(labelId, { status: originalStatus })
    } catch (restoreError) {
      console.error(
        '[reanalyzeLabel] Failed to restore original status:',
        restoreError,
      )
    }

    return logActionError(
      'reanalyzeLabel',
      error,
      'An unexpected error occurred during re-analysis',
    )
  }
}
