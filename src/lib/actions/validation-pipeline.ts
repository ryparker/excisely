import { updateImageTypes } from '@/db/mutations/labels'
import {
  insertValidationResult,
  insertValidationItems,
} from '@/db/mutations/validation'
import { type NewValidationItem } from '@/db/schema'
import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import type { ExtractionResult } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import {
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  type ValidationItemStatus,
  type LabelStatus,
} from '@/lib/labels/validation-helpers'
import { getAutoApprovalEnabled } from '@/db/queries/settings'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationPipelineInput {
  labelId: string
  imageUrls: string[]
  /** Parallel array of image record IDs matching imageUrls order. */
  imageRecordIds: string[]
  beverageType: BeverageType
  containerSizeMl: number
  expectedFields: Map<string, string>
  /** Optional transform applied to extraction.rawResponse before inserting the validation result. */
  rawResponseTransform?: (rawResponse: unknown) => unknown
  /** Pre-fetched image buffers (overlapped with DB writes to save ~150ms). */
  preloadedBuffers?: Buffer[]
}

export interface ValidationPipelineOutput {
  validationResultId: string
  overallStatus: LabelStatus
  overallConfidence: number
  deadlineDays: number | null
  /** Whether auto-approval would apply (overallStatus === 'approved' AND setting enabled). */
  autoApproved: boolean
  extraction: ExtractionResult
}

// ---------------------------------------------------------------------------
// Shared pipeline
// ---------------------------------------------------------------------------

/**
 * Core AI validation pipeline shared by validate-label, submit-application,
 * and reanalyze-label server actions.
 *
 * Handles: AI extraction → image type updates → field comparison →
 * validation result + items insertion → overall status determination.
 *
 * Does NOT update the label status — callers handle that because each action
 * has different status update logic (deadlines, error recovery, etc.).
 */
export async function runValidationPipeline(
  input: ValidationPipelineInput,
): Promise<ValidationPipelineOutput> {
  const {
    labelId,
    imageUrls,
    imageRecordIds,
    beverageType,
    containerSizeMl,
    expectedFields,
    rawResponseTransform,
    preloadedBuffers,
  } = input

  // 1. Run AI extraction with application data for disambiguation
  const appDataForAI = Object.fromEntries(expectedFields)
  const extraction = await extractLabelFieldsForSubmission(
    imageUrls,
    beverageType,
    appDataForAI,
    preloadedBuffers,
  )

  // 2. Update image types from AI classification (60% confidence threshold)
  if (extraction.imageClassifications.length > 0) {
    const imageTypeUpdates = extraction.imageClassifications
      .filter((ic) => imageRecordIds[ic.imageIndex] && ic.confidence >= 60)
      .map((ic) => ({
        id: imageRecordIds[ic.imageIndex],
        imageType: ic.imageType,
      }))
    if (imageTypeUpdates.length > 0) {
      await updateImageTypes(imageTypeUpdates)
    }
  }

  // 3. Compare each extracted field against application data
  const fieldComparisons: FieldComparison[] = []
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

  // 4. Insert validation result
  const rawResponse = rawResponseTransform
    ? rawResponseTransform(extraction.rawResponse)
    : extraction.rawResponse

  const validationResult = await insertValidationResult({
    labelId,
    aiRawResponse: rawResponse,
    processingTimeMs: extraction.processingTimeMs,
    modelUsed: extraction.modelUsed,
    inputTokens: extraction.metrics.inputTokens,
    outputTokens: extraction.metrics.outputTokens,
    totalTokens: extraction.metrics.totalTokens,
    isCurrent: true,
  })

  // 5. Insert validation items
  if (fieldComparisons.length > 0) {
    await insertValidationItems(
      fieldComparisons.map((comp) => {
        const labelImageId =
          imageRecordIds[comp.imageIndex] ?? imageRecordIds[0] ?? null

        return {
          validationResultId: validationResult.id,
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
          bboxHeight: comp.boundingBox ? String(comp.boundingBox.height) : null,
          bboxAngle: comp.boundingBox ? String(comp.boundingBox.angle) : null,
        }
      }),
    )
  }

  // 6. Determine overall status
  const itemStatuses = fieldComparisons.map((comp) => ({
    fieldName: comp.fieldName,
    status: comp.status,
  }))

  const { status: overallStatus, deadlineDays } = determineOverallStatus(
    itemStatuses,
    beverageType,
    containerSizeMl,
  )

  // 7. Calculate overall confidence
  const confidences = fieldComparisons.map((c) => c.confidence)
  const overallConfidence =
    confidences.length > 0
      ? Math.round(
          confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
        )
      : 0

  // 8. Check auto-approval setting
  const autoApprovalEnabled = await getAutoApprovalEnabled()
  const autoApproved = autoApprovalEnabled && overallStatus === 'approved'

  return {
    validationResultId: validationResult.id,
    overallStatus,
    overallConfidence,
    deadlineDays,
    autoApproved,
    extraction,
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface FieldComparison {
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
}
