'use server'

import { eq, sql } from 'drizzle-orm'
import pLimit from 'p-limit'

import { db } from '@/db'
import {
  applicants,
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
import { validateImageUrl } from '@/lib/validators/file-schema'
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

export interface BatchLabelInput {
  imageUrls: string[]
  beverageType: string
  containerSizeMl: number
  fields: Record<string, string>
}

type SubmitBatchResult =
  | {
      success: true
      batchId: string
      totalSubmitted: number
      failedCount: number
      labelIds: string[]
      errors: Array<{ index: number; error: string }>
    }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Concurrency limit for parallel AI processing
// ---------------------------------------------------------------------------

const AI_CONCURRENCY = 3

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function submitBatchApplication(
  items: BatchLabelInput[],
): Promise<SubmitBatchResult> {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (items.length === 0) {
    return { success: false, error: 'No labels provided' }
  }

  if (items.length > 50) {
    return { success: false, error: 'Maximum 50 labels per batch' }
  }

  try {
    // 2. Look up applicant record
    const [applicantRecord] = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(eq(applicants.contactEmail, session.user.email))
      .limit(1)

    // 3. Create batch record
    const [batch] = await db
      .insert(batches)
      .values({
        specialistId: session.user.id,
        applicantId: applicantRecord?.id ?? null,
        name: `Batch Upload — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        status: 'processing',
        totalLabels: items.length,
      })
      .returning({ id: batches.id })

    // 4. Process each label concurrently with p-limit
    const limit = pLimit(AI_CONCURRENCY)
    const labelIds: string[] = []
    const errors: Array<{ index: number; error: string }> = []
    const autoApprovalEnabled = await getAutoApprovalEnabled()

    const tasks = items.map((item, index) =>
      limit(async () => {
        try {
          const result = await processOneLabel(
            item,
            batch.id,
            applicantRecord?.id ?? null,
            autoApprovalEnabled,
          )
          if (result.success) {
            labelIds.push(result.labelId)
          } else {
            errors.push({ index, error: result.error })
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unexpected error'
          errors.push({ index, error: message })
        }
      }),
    )

    await Promise.all(tasks)

    // 5. Update batch counts
    const processedCount = labelIds.length + errors.length
    const batchUpdate: Record<string, unknown> = {
      processedCount,
      updatedAt: new Date(),
    }

    if (processedCount >= items.length) {
      batchUpdate.status =
        errors.length === items.length ? 'failed' : 'completed'
    }

    await db.update(batches).set(batchUpdate).where(eq(batches.id, batch.id))

    return {
      success: true,
      batchId: batch.id,
      totalSubmitted: labelIds.length,
      failedCount: errors.length,
      labelIds,
      errors,
    }
  } catch (error) {
    console.error('[submitBatchApplication] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during batch submission',
    }
  }
}

// ---------------------------------------------------------------------------
// Process a single label within the batch
// ---------------------------------------------------------------------------

async function processOneLabel(
  item: BatchLabelInput,
  batchId: string,
  applicantId: string | null,
  autoApprovalEnabled: boolean,
): Promise<
  { success: true; labelId: string } | { success: false; error: string }
> {
  // Validate image URLs
  if (!item.imageUrls || item.imageUrls.length === 0) {
    return { success: false, error: 'No image URLs provided' }
  }

  for (const url of item.imageUrls) {
    if (!validateImageUrl(url)) {
      return { success: false, error: `Invalid image URL: ${url}` }
    }
  }

  // Validate beverage type
  const validBeverageTypes = ['distilled_spirits', 'wine', 'malt_beverage']
  if (!validBeverageTypes.includes(item.beverageType)) {
    return {
      success: false,
      error: `Invalid beverage type: ${item.beverageType}`,
    }
  }

  // Create label record
  const [label] = await db
    .insert(labels)
    .values({
      specialistId: null,
      applicantId,
      batchId,
      beverageType: item.beverageType as BeverageType,
      containerSizeMl: item.containerSizeMl,
      status: 'processing',
    })
    .returning({ id: labels.id })

  // Create application data from fields
  const f = item.fields
  await db.insert(applicationData).values({
    labelId: label.id,
    serialNumber: f.serial_number || f.serialNumber || null,
    brandName: f.brand_name || f.brandName || null,
    fancifulName: f.fanciful_name || f.fancifulName || null,
    classType: f.class_type || f.classType || null,
    classTypeCode: f.class_type_code || f.classTypeCode || null,
    alcoholContent: f.alcohol_content || f.alcoholContent || null,
    netContents: f.net_contents || f.netContents || null,
    healthWarning: f.health_warning || f.healthWarning || null,
    nameAndAddress: f.name_and_address || f.nameAndAddress || null,
    qualifyingPhrase: f.qualifying_phrase || f.qualifyingPhrase || null,
    countryOfOrigin: f.country_of_origin || f.countryOfOrigin || null,
    grapeVarietal: f.grape_varietal || f.grapeVarietal || null,
    appellationOfOrigin:
      f.appellation_of_origin || f.appellationOfOrigin || null,
    vintageYear: f.vintage_year || f.vintageYear || null,
    sulfiteDeclaration: f.sulfite_declaration === 'true' || false,
    ageStatement: f.age_statement || f.ageStatement || null,
    stateOfDistillation:
      f.state_of_distillation || f.stateOfDistillation || null,
  })

  // Create image records
  const imageRecords = await db
    .insert(labelImages)
    .values(
      item.imageUrls.map((url, index) => ({
        labelId: label.id,
        imageUrl: url,
        imageFilename: url.split('/').pop() ?? `image-${index}`,
        imageType: index === 0 ? ('front' as const) : ('other' as const),
        sortOrder: index,
      })),
    )
    .returning({ id: labelImages.id })

  // Build expected fields for comparison
  const expectedFields = buildExpectedFields(
    {
      brandName: f.brand_name || f.brandName,
      fancifulName: f.fanciful_name || f.fancifulName,
      classType: f.class_type || f.classType,
      alcoholContent: f.alcohol_content || f.alcoholContent,
      netContents: f.net_contents || f.netContents,
      healthWarning: f.health_warning || f.healthWarning,
      nameAndAddress: f.name_and_address || f.nameAndAddress,
      qualifyingPhrase: f.qualifying_phrase || f.qualifyingPhrase,
      countryOfOrigin: f.country_of_origin || f.countryOfOrigin,
      grapeVarietal: f.grape_varietal || f.grapeVarietal,
      appellationOfOrigin: f.appellation_of_origin || f.appellationOfOrigin,
      vintageYear: f.vintage_year || f.vintageYear,
      ageStatement: f.age_statement || f.ageStatement,
      stateOfDistillation: f.state_of_distillation || f.stateOfDistillation,
      sulfiteDeclaration: f.sulfite_declaration === 'true' ? true : undefined,
    } as Record<string, unknown>,
    item.beverageType as BeverageType,
  )

  // Run AI pipeline
  const appDataForAI = Object.fromEntries(expectedFields)
  const extraction = await extractLabelFields(
    item.imageUrls,
    item.beverageType,
    appDataForAI,
  )

  // Update image types from AI classification
  if (extraction.imageClassifications.length > 0) {
    for (const ic of extraction.imageClassifications) {
      const imageRecord = imageRecords[ic.imageIndex]
      if (imageRecord && ic.confidence >= 60) {
        await db
          .update(labelImages)
          .set({ imageType: ic.imageType })
          .where(eq(labelImages.id, imageRecord.id))
      }
    }
  }

  // Compare fields
  const extractedByName = new Map(
    extraction.fields.map((ef) => [ef.fieldName, ef]),
  )

  const fieldComparisons: Array<{
    fieldName: string
    expectedValue: string
    extractedValue: string
    status: ValidationItemStatus
    confidence: number
    reasoning: string
    boundingBox: { x: number; y: number; width: number; height: number } | null
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
      labelId: label.id,
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
          imageRecords[comp.imageIndex]?.id ?? imageRecords[0]?.id ?? null

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
          bboxHeight: comp.boundingBox ? String(comp.boundingBox.height) : null,
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
    item.beverageType as BeverageType,
    item.containerSizeMl,
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

  // Apply final status
  const finalStatus =
    autoApprovalEnabled && overallStatus === 'approved'
      ? 'approved'
      : 'pending_review'

  await db
    .update(labels)
    .set({
      status: finalStatus,
      aiProposedStatus: finalStatus === 'pending_review' ? overallStatus : null,
      overallConfidence: String(overallConfidence),
      correctionDeadline:
        finalStatus === 'pending_review' ? correctionDeadline : null,
    })
    .where(eq(labels.id, label.id))

  // Update batch status counters
  const statusCountUpdates: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (finalStatus === 'approved') {
    statusCountUpdates.approvedCount = sql`${batches.approvedCount} + 1`
  } else if (finalStatus === 'pending_review') {
    if (overallStatus === 'conditionally_approved') {
      statusCountUpdates.conditionallyApprovedCount = sql`${batches.conditionallyApprovedCount} + 1`
    } else if (overallStatus === 'needs_correction') {
      statusCountUpdates.needsCorrectionCount = sql`${batches.needsCorrectionCount} + 1`
    } else if (overallStatus === 'rejected') {
      statusCountUpdates.rejectedCount = sql`${batches.rejectedCount} + 1`
    }
  }

  await db
    .update(batches)
    .set(statusCountUpdates)
    .where(eq(batches.id, batchId))

  return { success: true, labelId: label.id }
}
