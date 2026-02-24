'use server'

import {
  insertLabel,
  insertApplicationData,
  insertLabelImages,
  updateImageTypes,
  updateLabelStatus,
} from '@/db/mutations/labels'
import {
  insertValidationResult,
  insertValidationItems,
} from '@/db/mutations/validation'
import { type NewValidationItem } from '@/db/schema'
import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { parseImageUrls } from '@/lib/actions/parse-image-urls'
import { validateLabelSchema } from '@/lib/validators/label-schema'
import {
  buildExpectedFields,
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'
import { getAutoApprovalEnabled } from '@/db/queries/settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ValidateLabelResult =
  | { success: true; labelId: string }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function validateLabel(
  formData: FormData,
): Promise<ValidateLabelResult> {
  // 1. Authenticate
  const guard = await guardSpecialist()
  if (!guard.success) return guard
  const { session } = guard

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
      priorLabelId: (formData.get('priorLabelId') as string) || undefined,
    }

    const parsed = validateLabelSchema.safeParse(rawData)
    if (!parsed.success) {
      return { success: false, error: formatZodError(parsed.error) }
    }

    const input = parsed.data

    // 3. Extract and validate image URLs
    const imageUrlsResult = parseImageUrls(formData)
    if (!imageUrlsResult.success) return imageUrlsResult
    const { imageUrls } = imageUrlsResult

    // 4. Create label record with status "processing"
    const label = await insertLabel({
      specialistId: session.user.id,
      applicantId: input.applicantId || null,
      priorLabelId: input.priorLabelId || null,
      beverageType: input.beverageType,
      containerSizeMl: input.containerSizeMl,
      status: 'processing',
    })

    // 5. Create application data record
    await insertApplicationData({
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
    const imageRecords = await insertLabelImages(
      imageUrls.map((url, index) => ({
        labelId: label.id,
        imageUrl: url,
        imageFilename: url.split('/').pop() ?? `image-${index}`,
        imageType: index === 0 ? ('front' as const) : ('other' as const),
        sortOrder: index,
      })),
    )

    // 7. Build expected fields from application data (needed for AI pipeline + comparison)
    const expectedFields = buildExpectedFields(input, input.beverageType)

    // 8. Run AI pipeline with application data for disambiguation
    const appDataForAI = Object.fromEntries(expectedFields)
    const extraction = await extractLabelFieldsForSubmission(
      imageUrls,
      input.beverageType,
      appDataForAI,
    )

    // 8b. Update image types from AI classification
    if (extraction.imageClassifications.length > 0) {
      const imageTypeUpdates = extraction.imageClassifications
        .filter((ic) => imageRecords[ic.imageIndex] && ic.confidence >= 60)
        .map((ic) => ({
          id: imageRecords[ic.imageIndex].id,
          imageType: ic.imageType,
        }))
      if (imageTypeUpdates.length > 0) {
        await updateImageTypes(imageTypeUpdates)
      }
    }

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
        angle: number
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
    const validationResult = await insertValidationResult({
      labelId: label.id,
      aiRawResponse: extraction.rawResponse,
      processingTimeMs: extraction.processingTimeMs,
      modelUsed: extraction.modelUsed,
      inputTokens: extraction.metrics.inputTokens,
      outputTokens: extraction.metrics.outputTokens,
      totalTokens: extraction.metrics.totalTokens,
      isCurrent: true,
    })

    // 11. Create validation item records
    if (fieldComparisons.length > 0) {
      await insertValidationItems(
        fieldComparisons.map((comp) => {
          // Find the label image record for this comparison's image index
          const labelImageId =
            imageRecords[comp.imageIndex]?.id ?? imageRecords[0]?.id ?? null

          return {
            validationResultId: validationResult.id,
            labelImageId: labelImageId,
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

    // 12. Determine overall status
    const itemStatuses = fieldComparisons.map((comp) => ({
      fieldName: comp.fieldName,
      status: comp.status,
    }))

    const { status: overallStatus } = determineOverallStatus(
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
    // Only auto-approve when the setting is enabled; otherwise route all labels through specialist review
    const autoApprovalEnabled = await getAutoApprovalEnabled()

    if (autoApprovalEnabled && overallStatus === 'approved') {
      await updateLabelStatus(label.id, {
        status: 'approved',
        overallConfidence: String(overallConfidence),
      })
    } else {
      await updateLabelStatus(label.id, {
        status: 'pending_review',
        aiProposedStatus: overallStatus,
        overallConfidence: String(overallConfidence),
      })
    }

    return { success: true, labelId: label.id }
  } catch (error) {
    console.error('[validateLabel] Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during validation',
    }
  }
}
