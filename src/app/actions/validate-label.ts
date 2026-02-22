'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  applicationData,
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
import { validateLabelSchema } from '@/lib/validators/label-schema'
import { validateImageUrl } from '@/lib/validators/file-schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ValidateLabelResult =
  | { success: true; labelId: string }
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

/**
 * Fields where a mismatch is considered minor — the label can still
 * receive "conditionally approved" status with a 7-day correction window.
 */
const MINOR_DISCREPANCY_FIELDS = new Set([
  'brand_name',
  'fanciful_name',
  'appellation_of_origin',
  'grape_varietal',
])

/**
 * Fields where a missing or mismatched value triggers immediate rejection.
 */
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

/**
 * Maps application data fields to the field names used by the AI pipeline
 * and comparison engine, returning key-value pairs for every field that
 * was provided in the application.
 */
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

  // Handle sulfite declaration as a boolean → text
  if (data.sulfiteDeclaration === true) {
    fields.set('sulfite_declaration', 'Contains Sulfites')
  }

  // Always expect health warning for all beverage types
  if (!fields.has('health_warning')) {
    fields.set('health_warning', HEALTH_WARNING_FULL)
  }

  // Only include fields that are mandatory or were explicitly provided
  const mandatory = new Set(getMandatoryFields(beverageType))
  const result = new Map<string, string>()

  for (const [fieldName, value] of fields) {
    result.set(fieldName, value)
  }

  // Add mandatory fields that were not provided — they must still be checked
  for (const fieldName of mandatory) {
    if (!result.has(fieldName)) {
      // For mandatory fields with no expected value, we still need to
      // verify they exist on the label. Use empty string to signal
      // "must be present but no specific value to compare against."
      // However, health_warning always has a known expected value.
      if (fieldName === 'health_warning') {
        result.set(fieldName, HEALTH_WARNING_FULL)
      }
    }
  }

  return result
}

/**
 * Determines the overall label status based on individual field comparison
 * results and container size validity.
 */
function determineOverallStatus(
  itemStatuses: Array<{ fieldName: string; status: ValidationItemStatus }>,
  beverageType: BeverageType,
  containerSizeMl: number,
): { status: LabelStatus; deadlineDays: number | null } {
  // Check container size validity first
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
        // Optional field mismatch — minor discrepancy
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
// Server Action
// ---------------------------------------------------------------------------

export async function validateLabel(
  formData: FormData,
): Promise<ValidateLabelResult> {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    // 2. Parse and validate form data
    const rawData = {
      beverageType: formData.get('beverageType') as string,
      containerSizeMl: Number(formData.get('containerSizeMl')),
      classTypeCode: (formData.get('classTypeCode') as string) || undefined,
      serialNumber: (formData.get('serialNumber') as string) || undefined,
      brandName: formData.get('brandName') as string,
      fancifulName: (formData.get('fancifulName') as string) || undefined,
      classType: (formData.get('classType') as string) || undefined,
      alcoholContent: (formData.get('alcoholContent') as string) || undefined,
      netContents: (formData.get('netContents') as string) || undefined,
      healthWarning: (formData.get('healthWarning') as string) || undefined,
      nameAndAddress: (formData.get('nameAndAddress') as string) || undefined,
      qualifyingPhrase:
        (formData.get('qualifyingPhrase') as string) || undefined,
      countryOfOrigin: (formData.get('countryOfOrigin') as string) || undefined,
      grapeVarietal: (formData.get('grapeVarietal') as string) || undefined,
      appellationOfOrigin:
        (formData.get('appellationOfOrigin') as string) || undefined,
      vintageYear: (formData.get('vintageYear') as string) || undefined,
      sulfiteDeclaration:
        formData.get('sulfiteDeclaration') === 'true' || undefined,
      ageStatement: (formData.get('ageStatement') as string) || undefined,
      stateOfDistillation:
        (formData.get('stateOfDistillation') as string) || undefined,
      applicantId: (formData.get('applicantId') as string) || undefined,
      batchId: (formData.get('batchId') as string) || undefined,
      priorLabelId: (formData.get('priorLabelId') as string) || undefined,
    }

    const parsed = validateLabelSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return {
        success: false,
        error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
      }
    }

    const input = parsed.data

    // 3. Extract and validate image URLs
    const imageUrlsRaw = formData.get('imageUrls')
    if (!imageUrlsRaw || typeof imageUrlsRaw !== 'string') {
      return { success: false, error: 'No image URLs provided' }
    }

    let imageUrls: string[]
    try {
      imageUrls = JSON.parse(imageUrlsRaw)
    } catch {
      return { success: false, error: 'Invalid image URLs format' }
    }

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return { success: false, error: 'At least one label image is required' }
    }

    for (const url of imageUrls) {
      if (!validateImageUrl(url)) {
        return { success: false, error: `Invalid image URL: ${url}` }
      }
    }

    // 4. Create label record with status "processing"
    const [label] = await db
      .insert(labels)
      .values({
        specialistId: session.user.id,
        applicantId: input.applicantId || null,
        batchId: input.batchId || null,
        priorLabelId: input.priorLabelId || null,
        beverageType: input.beverageType,
        containerSizeMl: input.containerSizeMl,
        status: 'processing',
      })
      .returning({ id: labels.id })

    // 5. Create application data record
    await db.insert(applicationData).values({
      labelId: label.id,
      serialNumber: input.serialNumber || null,
      brandName: input.brandName,
      fancifulName: input.fancifulName || null,
      classType: input.classType || null,
      classTypeCode: input.classTypeCode || null,
      alcoholContent: input.alcoholContent || null,
      netContents: input.netContents || null,
      healthWarning: input.healthWarning || null,
      nameAndAddress: input.nameAndAddress || null,
      qualifyingPhrase: input.qualifyingPhrase || null,
      countryOfOrigin: input.countryOfOrigin || null,
      grapeVarietal: input.grapeVarietal || null,
      appellationOfOrigin: input.appellationOfOrigin || null,
      vintageYear: input.vintageYear || null,
      sulfiteDeclaration: input.sulfiteDeclaration ?? null,
      ageStatement: input.ageStatement || null,
      stateOfDistillation: input.stateOfDistillation || null,
    })

    // 6. Create label image records
    const imageRecords = await db
      .insert(labelImages)
      .values(
        imageUrls.map((url, index) => ({
          labelId: label.id,
          imageUrl: url,
          imageFilename: url.split('/').pop() ?? `image-${index}`,
          imageType: index === 0 ? ('front' as const) : ('other' as const),
          sortOrder: index,
        })),
      )
      .returning({ id: labelImages.id })

    // 7. Run AI pipeline
    const extraction = await extractLabelFields(imageUrls, input.beverageType)

    // 8. Build expected fields from application data
    const expectedFields = buildExpectedFields(
      input as unknown as Record<string, unknown>,
      input.beverageType,
    )

    // 9. Compare each extracted field against application data
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

    // Build a lookup from extracted fields by field name
    const extractedByName = new Map(
      extraction.fields.map((f) => [f.fieldName, f]),
    )

    for (const [fieldName, expectedValue] of expectedFields) {
      const extracted = extractedByName.get(fieldName)
      const extractedValue = extracted?.value ?? null

      const comparison = compareField(fieldName, expectedValue, extractedValue)

      // Map comparison status to validation item status
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

    // 10. Create validation result record
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

    // 11. Create validation item records
    if (fieldComparisons.length > 0) {
      await db.insert(validationItems).values(
        fieldComparisons.map((comp) => {
          // Find the label image record for this comparison's image index
          const labelImageId =
            imageRecords[comp.imageIndex]?.id ?? imageRecords[0]?.id ?? null

          return {
            validationResultId: validationResult.id,
            labelImageId: labelImageId,
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

    // 12. Determine overall status
    const itemStatuses = fieldComparisons.map((comp) => ({
      fieldName: comp.fieldName,
      status: comp.status,
    }))

    const { status: overallStatus, deadlineDays } = determineOverallStatus(
      itemStatuses,
      input.beverageType,
      input.containerSizeMl,
    )

    // 13. Calculate overall confidence
    const confidences = fieldComparisons.map((c) => c.confidence)
    const overallConfidence =
      confidences.length > 0
        ? Math.round(
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
          )
        : 0

    // 14. Update label with final status and confidence
    const correctionDeadline = deadlineDays
      ? addDays(new Date(), deadlineDays)
      : null

    await db
      .update(labels)
      .set({
        status: overallStatus,
        overallConfidence: String(overallConfidence),
        correctionDeadline,
      })
      .where(eq(labels.id, label.id))

    return { success: true, labelId: label.id }
  } catch (error) {
    console.error('[validateLabel] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during validation',
    }
  }
}
