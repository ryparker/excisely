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
import {
  getMandatoryFields,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProcessBatchItemResult =
  | { success: true; labelId: string; status: string }
  | { success: false; error: string }

type LabelStatus =
  | 'approved'
  | 'conditionally_approved'
  | 'needs_correction'
  | 'rejected'

type ValidationItemStatus =
  | 'match'
  | 'mismatch'
  | 'not_found'
  | 'needs_correction'

const MINOR_DISCREPANCY_FIELDS = new Set([
  'brand_name',
  'fanciful_name',
  'appellation_of_origin',
  'grape_varietal',
])

const REJECTION_FIELDS = new Set(['health_warning'])

const CONDITIONAL_DEADLINE_DAYS = 7
const CORRECTION_DEADLINE_DAYS = 30

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function buildExpectedFields(
  data: Record<string, unknown>,
  beverageType: BeverageType,
): Map<string, string> {
  const fields = new Map<string, string>()

  const mapping: Record<string, string> = {
    brandName: 'brand_name',
    fancifulName: 'fanciful_name',
    classType: 'class_type',
    alcoholContent: 'alcohol_content',
    netContents: 'net_contents',
    healthWarning: 'health_warning',
    nameAndAddress: 'name_and_address',
    qualifyingPhrase: 'qualifying_phrase',
    countryOfOrigin: 'country_of_origin',
    grapeVarietal: 'grape_varietal',
    appellationOfOrigin: 'appellation_of_origin',
    vintageYear: 'vintage_year',
    ageStatement: 'age_statement',
    stateOfDistillation: 'state_of_distillation',
  }

  for (const [camelKey, fieldName] of Object.entries(mapping)) {
    const value = data[camelKey]
    if (typeof value === 'string' && value.trim() !== '') {
      fields.set(fieldName, value.trim())
    }
  }

  if (data.sulfiteDeclaration === true) {
    fields.set('sulfite_declaration', 'Contains Sulfites')
  }

  if (!fields.has('health_warning')) {
    fields.set('health_warning', HEALTH_WARNING_FULL)
  }

  const mandatory = new Set(getMandatoryFields(beverageType))
  const result = new Map<string, string>()

  for (const [fieldName, value] of fields) {
    result.set(fieldName, value)
  }

  for (const fieldName of mandatory) {
    if (!result.has(fieldName)) {
      if (fieldName === 'health_warning') {
        result.set(fieldName, HEALTH_WARNING_FULL)
      }
    }
  }

  return result
}

function determineOverallStatus(
  itemStatuses: Array<{ fieldName: string; status: ValidationItemStatus }>,
  beverageType: BeverageType,
  containerSizeMl: number,
): { status: LabelStatus; deadlineDays: number | null } {
  if (!isValidSize(beverageType, containerSizeMl)) {
    return { status: 'rejected', deadlineDays: null }
  }

  const mandatory = new Set(getMandatoryFields(beverageType))

  let hasRejection = false
  let hasSubstantiveMismatch = false
  let hasMinorDiscrepancy = false

  for (const item of itemStatuses) {
    const isMandatory = mandatory.has(item.fieldName)
    const isRejectionField = REJECTION_FIELDS.has(item.fieldName)
    const isMinorField = MINOR_DISCREPANCY_FIELDS.has(item.fieldName)

    if (item.status === 'match') {
      continue
    }

    if (item.status === 'not_found' && isMandatory) {
      if (isRejectionField) {
        hasRejection = true
      } else {
        hasSubstantiveMismatch = true
      }
      continue
    }

    if (item.status === 'mismatch' || item.status === 'needs_correction') {
      if (isRejectionField) {
        hasRejection = true
      } else if (isMinorField) {
        hasMinorDiscrepancy = true
      } else if (isMandatory) {
        hasSubstantiveMismatch = true
      } else {
        hasMinorDiscrepancy = true
      }
    }
  }

  if (hasRejection) {
    return { status: 'rejected', deadlineDays: null }
  }

  if (hasSubstantiveMismatch) {
    return {
      status: 'needs_correction',
      deadlineDays: CORRECTION_DEADLINE_DAYS,
    }
  }

  if (hasMinorDiscrepancy) {
    return {
      status: 'conditionally_approved',
      deadlineDays: CONDITIONAL_DEADLINE_DAYS,
    }
  }

  return { status: 'approved', deadlineDays: null }
}

// ---------------------------------------------------------------------------
// Batch count column map
// ---------------------------------------------------------------------------

const STATUS_COUNT_COLUMN: Record<string, keyof typeof batches.$inferSelect> = {
  approved: 'approvedCount',
  conditionally_approved: 'conditionallyApprovedCount',
  needs_correction: 'needsCorrectionCount',
  rejected: 'rejectedCount',
}

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

    // Build expected fields
    const expectedFields = buildExpectedFields(
      appData as unknown as Record<string, unknown>,
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

    // Update label with final status
    await db
      .update(labels)
      .set({
        status: overallStatus,
        overallConfidence: String(overallConfidence),
        correctionDeadline,
      })
      .where(eq(labels.id, labelId))

    // Update batch counts — increment processedCount and the appropriate status counter
    const countColumn = STATUS_COUNT_COLUMN[overallStatus]

    if (countColumn) {
      // Use raw SQL to atomically increment the right column
      const columnName =
        overallStatus === 'approved'
          ? 'approved_count'
          : overallStatus === 'conditionally_approved'
            ? 'conditionally_approved_count'
            : overallStatus === 'needs_correction'
              ? 'needs_correction_count'
              : 'rejected_count'

      await db.execute(
        sql`UPDATE batches
            SET processed_count = processed_count + 1,
                ${sql.raw(columnName)} = ${sql.raw(columnName)} + 1,
                updated_at = NOW()
            WHERE id = ${label.batchId}`,
      )
    } else {
      await db.execute(
        sql`UPDATE batches
            SET processed_count = processed_count + 1,
                updated_at = NOW()
            WHERE id = ${label.batchId}`,
      )
    }

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

    return { success: true, labelId, status: overallStatus }
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
