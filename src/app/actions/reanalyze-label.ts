'use server'

import { updateTag } from 'next/cache'

import {
  getLabelById,
  getLabelAppData,
  getLabelImages,
} from '@/db/queries/labels'
import { getCurrentValidationResult } from '@/db/queries/validation'
import { updateImageTypes, updateLabelStatus } from '@/db/mutations/labels'
import {
  insertValidationResult,
  insertValidationItems,
  supersedeValidationResult,
} from '@/db/mutations/validation'
import { type NewValidationItem } from '@/db/schema'
import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import { guardSpecialist } from '@/lib/auth/action-guards'
import {
  addDays,
  buildExpectedFields,
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'
import { getAutoApprovalEnabled } from '@/db/queries/settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReanalyzeLabelResult =
  | { success: true; labelId: string }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function reanalyzeLabel(
  labelId: string,
): Promise<ReanalyzeLabelResult> {
  // 1. Auth check — specialist only
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  // 2. Fetch the label
  const label = await getLabelById(labelId)

  if (!label) {
    return { success: false, error: 'Label not found' }
  }

  if (label.status === 'processing') {
    return { success: false, error: 'Label is already being processed' }
  }

  // 3. Save original status for error recovery
  const originalStatus = label.status

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

    // 6. Build expected fields
    const expectedFields = buildExpectedFields(appData, label.beverageType)

    // 7. Run AI pipeline (outside transaction — external API call)
    const appDataForAI = Object.fromEntries(expectedFields)
    const extraction = await extractLabelFieldsForSubmission(
      imageUrls,
      label.beverageType,
      appDataForAI,
    )

    // 7b. Update image types from AI classification
    if (extraction.imageClassifications.length > 0) {
      const imageTypeUpdates = extraction.imageClassifications
        .filter((ic) => images[ic.imageIndex] && ic.confidence >= 60)
        .map((ic) => ({
          id: images[ic.imageIndex].id,
          imageType: ic.imageType,
        }))
      if (imageTypeUpdates.length > 0) {
        await updateImageTypes(imageTypeUpdates)
      }
    }

    // 8. Compare each extracted field against application data
    const fieldComparisons: Array<{
      fieldName: string
      expectedValue: string
      extractedValue: string
      status: ValidationItemStatus
      confidence: number
      reasoning: string
      boundingBox: {
        x: number
        y: number
        width: number
        height: number
        angle: number
      } | null
      imageIndex: number
    }> = []

    const extractedByName = new Map(
      extraction.fields.map((f) => [f.fieldName, f]),
    )

    for (const [fieldName, expectedValue] of expectedFields) {
      const extracted = extractedByName.get(fieldName)
      const extractedValue = extracted?.value ?? null

      const comparison = compareField(fieldName, expectedValue, extractedValue)

      let itemStatus: ValidationItemStatus = comparison.status
      if (
        comparison.status === 'mismatch' &&
        MINOR_DISCREPANCY_FIELDS.has(fieldName)
      ) {
        itemStatus = 'needs_correction'
      }

      fieldComparisons.push({
        fieldName,
        expectedValue,
        extractedValue: extractedValue ?? '',
        status: itemStatus,
        confidence: comparison.confidence,
        reasoning: comparison.reasoning,
        boundingBox: extracted?.boundingBox ?? null,
        imageIndex: extracted?.imageIndex ?? 0,
      })
    }

    // 9. Create new result, supersede old, insert items, update label
    // (No transaction — neon-http driver doesn't support them)
    const currentResult = await getCurrentValidationResult(labelId)

    const newResult = await insertValidationResult({
      labelId,
      aiRawResponse: extraction.rawResponse,
      processingTimeMs: extraction.processingTimeMs,
      modelUsed: extraction.modelUsed,
      inputTokens: extraction.metrics.inputTokens,
      outputTokens: extraction.metrics.outputTokens,
      totalTokens: extraction.metrics.totalTokens,
      isCurrent: true,
    })

    if (currentResult) {
      await supersedeValidationResult(currentResult.id, newResult.id)
    }

    if (fieldComparisons.length > 0) {
      await insertValidationItems(
        fieldComparisons.map((comp) => {
          const labelImageId =
            images[comp.imageIndex]?.id ?? images[0]?.id ?? null

          return {
            validationResultId: newResult.id,
            labelImageId,
            fieldName: comp.fieldName as NewValidationItem['fieldName'],
            expectedValue: comp.expectedValue,
            extractedValue: comp.extractedValue,
            status: comp.status,
            confidence: String(comp.confidence),
            matchReasoning: comp.reasoning,
            bboxX: comp.boundingBox ? String(comp.boundingBox.x) : null,
            bboxY: comp.boundingBox ? String(comp.boundingBox.y) : null,
            bboxWidth: comp.boundingBox ? String(comp.boundingBox.width) : null,
            bboxHeight: comp.boundingBox
              ? String(comp.boundingBox.height)
              : null,
            bboxAngle: comp.boundingBox ? String(comp.boundingBox.angle) : null,
          }
        }),
      )
    }

    const itemStatuses = fieldComparisons.map((comp) => ({
      fieldName: comp.fieldName,
      status: comp.status,
    }))

    const { status: overallStatus, deadlineDays } = determineOverallStatus(
      itemStatuses,
      label.beverageType,
      label.containerSizeMl,
    )

    const confidences = fieldComparisons.map((c) => c.confidence)
    const overallConfidence =
      confidences.length > 0
        ? Math.round(
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
          )
        : 0

    const autoApprovalEnabled = await getAutoApprovalEnabled()

    if (autoApprovalEnabled && overallStatus === 'approved') {
      await updateLabelStatus(labelId, {
        status: 'approved',
        overallConfidence: String(overallConfidence),
        aiProposedStatus: null,
        correctionDeadline: null,
        deadlineExpired: false,
      })
    } else {
      await updateLabelStatus(labelId, {
        status: 'pending_review',
        aiProposedStatus: overallStatus,
        overallConfidence: String(overallConfidence),
        correctionDeadline: deadlineDays
          ? addDays(new Date(), deadlineDays)
          : null,
        deadlineExpired: false,
      })
    }

    updateTag('labels')
    updateTag('sla-metrics')

    return { success: true, labelId }
  } catch (error) {
    // Error recovery: restore original status
    console.error('[reanalyzeLabel] Error:', error)
    try {
      await updateLabelStatus(labelId, { status: originalStatus })
    } catch (restoreError) {
      console.error(
        '[reanalyzeLabel] Failed to restore original status:',
        restoreError,
      )
    }

    return {
      success: false,
      error: 'An unexpected error occurred during re-analysis',
    }
  }
}
