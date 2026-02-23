'use server'

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  applicationData,
  batches,
  labelImages,
  labels,
  validationItems,
  validationResults,
} from '@/db/schema'
import { extractLabelFields } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import { getSession } from '@/lib/auth/get-session'
import { type BeverageType } from '@/config/beverage-types'
import {
  buildExpectedFields,
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  addDays,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'
import { getAutoApprovalEnabled } from '@/lib/settings/get-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessBatchItemResult =
  | { success: true; labelId: string; status: string }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function processBatchItem(
  labelId: string,
): Promise<ProcessBatchItemResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    // Fetch the label
    const [label] = await db
      .select()
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1)

    if (!label) {
      return { success: false, error: 'Label not found' }
    }

    if (!label.batchId) {
      return { success: false, error: 'Label is not part of a batch' }
    }

    // Update label status to processing
    await db
      .update(labels)
      .set({ status: 'processing' })
      .where(eq(labels.id, labelId))

    // Fetch application data and images
    const [appData, images] = await Promise.all([
      db
        .select()
        .from(applicationData)
        .where(eq(applicationData.labelId, labelId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(labelImages)
        .where(eq(labelImages.labelId, labelId))
        .orderBy(labelImages.sortOrder),
    ])

    if (!appData) {
      return { success: false, error: 'Application data not found for label' }
    }

    if (images.length === 0) {
      return { success: false, error: 'No images found for label' }
    }

    const imageUrls = images.map((img) => img.imageUrl)

    // Run AI pipeline
    const extraction = await extractLabelFields(imageUrls, label.beverageType)

    // Update image types from AI classification
    if (extraction.imageClassifications.length > 0) {
      for (const ic of extraction.imageClassifications) {
        const imageRecord = images[ic.imageIndex]
        if (imageRecord && ic.confidence >= 60) {
          await db
            .update(labelImages)
            .set({ imageType: ic.imageType })
            .where(eq(labelImages.id, imageRecord.id))
        }
      }
    }

    // Build expected fields
    const expectedFields = buildExpectedFields(
      appData as Record<string, unknown>,
      label.beverageType as BeverageType,
    )

    // Compare each extracted field
    const extractedByName = new Map(
      extraction.fields.map((f) => [f.fieldName, f]),
    )

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

    // Create validation result
    const [validationResult] = await db
      .insert(validationResults)
      .values({
        labelId,
        aiRawResponse: extraction.rawResponse,
        processingTimeMs: extraction.processingTimeMs,
        modelUsed: extraction.modelUsed,
        inputTokens: extraction.metrics.inputTokens,
        outputTokens: extraction.metrics.outputTokens,
        totalTokens: extraction.metrics.totalTokens,
        isCurrent: true,
      })
      .returning({ id: validationResults.id })

    // Create validation items
    if (fieldComparisons.length > 0) {
      await db.insert(validationItems).values(
        fieldComparisons.map((comp) => {
          const labelImageId =
            images[comp.imageIndex]?.id ?? images[0]?.id ?? null

          return {
            validationResultId: validationResult.id,
            labelImageId,
            fieldName:
              comp.fieldName as typeof validationItems.$inferInsert.fieldName,
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

    // Determine overall status
    const itemStatuses = fieldComparisons.map((comp) => ({
      fieldName: comp.fieldName,
      status: comp.status,
    }))

    const { status: overallStatus, deadlineDays } = determineOverallStatus(
      itemStatuses,
      label.beverageType as BeverageType,
      label.containerSizeMl,
    )

    // Calculate overall confidence
    const confidences = fieldComparisons.map((c) => c.confidence)
    const overallConfidence =
      confidences.length > 0
        ? Math.round(
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
          )
        : 0

    const correctionDeadline = deadlineDays
      ? addDays(new Date(), deadlineDays)
      : null

    // Check auto-approval setting — route to pending_review when disabled
    const autoApprovalEnabled = await getAutoApprovalEnabled()
    const finalStatus =
      autoApprovalEnabled && overallStatus === 'approved'
        ? 'approved'
        : 'pending_review'

    // Update label with final status
    await db
      .update(labels)
      .set({
        status: finalStatus,
        aiProposedStatus:
          finalStatus === 'pending_review' ? overallStatus : null,
        overallConfidence: String(overallConfidence),
        correctionDeadline:
          finalStatus === 'pending_review' ? correctionDeadline : null,
      })
      .where(eq(labels.id, labelId))

    // Update batch counts — increment processedCount and the appropriate status counter
    // Use finalStatus (not AI's overallStatus) so counters reflect actual label state
    const statusCountUpdates: Record<string, unknown> = {
      processedCount: sql`${batches.processedCount} + 1`,
      updatedAt: new Date(),
    }

    if (finalStatus === 'approved') {
      statusCountUpdates.approvedCount = sql`${batches.approvedCount} + 1`
    } else if (finalStatus === 'pending_review') {
      // pending_review labels are counted based on AI's proposed status for reporting
      if (overallStatus === 'conditionally_approved') {
        statusCountUpdates.conditionallyApprovedCount = sql`${batches.conditionallyApprovedCount} + 1`
      } else if (overallStatus === 'needs_correction') {
        statusCountUpdates.needsCorrectionCount = sql`${batches.needsCorrectionCount} + 1`
      } else if (overallStatus === 'rejected') {
        statusCountUpdates.rejectedCount = sql`${batches.rejectedCount} + 1`
      }
      // overallStatus === 'approved' routed to pending_review — no specific counter
    }

    await db
      .update(batches)
      .set(statusCountUpdates)
      .where(eq(batches.id, label.batchId))

    // Check if batch is complete
    const [updatedBatch] = await db
      .select({
        totalLabels: batches.totalLabels,
        processedCount: batches.processedCount,
      })
      .from(batches)
      .where(eq(batches.id, label.batchId))
      .limit(1)

    if (
      updatedBatch &&
      updatedBatch.processedCount >= updatedBatch.totalLabels
    ) {
      await db
        .update(batches)
        .set({ status: 'completed' })
        .where(eq(batches.id, label.batchId))
    }

    return { success: true, labelId, status: finalStatus }
  } catch (error) {
    console.error('[processBatchItem] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during processing',
    }
  }
}
