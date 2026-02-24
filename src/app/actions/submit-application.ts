'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  applicants,
  applicationData,
  labelImages,
  labels,
  validationItems,
  validationResults,
} from '@/db/schema'
import {
  extractLabelFieldsForSubmission,
  PipelineTimeoutError,
} from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import { getSession } from '@/lib/auth/get-session'
import { validateLabelSchema } from '@/lib/validators/label-schema'
import { validateImageUrl } from '@/lib/validators/file-schema'
import {
  buildExpectedFields,
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'
import { getAutoApprovalEnabled } from '@/lib/settings/get-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubmitApplicationResult =
  | { success: true; labelId: string; status: 'approved' | 'pending_review' }
  | { success: false; error: string; timeout?: boolean }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function submitApplication(
  formData: FormData,
): Promise<SubmitApplicationResult> {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role !== 'applicant') {
    return { success: false, error: 'Applicant access required' }
  }

  let labelId: string | null = null

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

    if (imageUrls.length > 10) {
      return { success: false, error: 'Maximum 10 images allowed' }
    }

    for (const url of imageUrls) {
      if (!validateImageUrl(url)) {
        return { success: false, error: `Invalid image URL: ${url}` }
      }
    }

    // 4. Look up applicant record by contactEmail matching session user's email
    const [applicantRecord] = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(eq(applicants.contactEmail, session.user.email))
      .limit(1)

    // 5. Create label record with status "processing" — no specialist assigned yet
    const [label] = await db
      .insert(labels)
      .values({
        specialistId: null,
        applicantId: applicantRecord?.id ?? null,
        beverageType: input.beverageType,
        containerSizeMl: input.containerSizeMl,
        status: 'processing',
      })
      .returning({ id: labels.id })

    labelId = label.id

    // 6. Create application data record
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

    // 7. Create label image records
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

    // 8. Build expected fields from application data (needed for AI pipeline + comparison)
    const expectedFields = buildExpectedFields(
      input as Record<string, unknown>,
      input.beverageType,
    )

    // 9. Run AI pipeline with application data for disambiguation
    const appDataForAI = Object.fromEntries(expectedFields)
    const extraction = await extractLabelFieldsForSubmission(
      imageUrls,
      input.beverageType,
      appDataForAI,
    )

    // 9b. Update image types from AI classification
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

    // 10. Compare each extracted field against application data
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

    // 10b. Compute correction delta from applicant's AI extraction edits
    let aiRawResponseWithCorrections = extraction.rawResponse as Record<
      string,
      unknown
    >
    const aiExtractedFieldsRaw = formData.get('aiExtractedFields')
    if (aiExtractedFieldsRaw && typeof aiExtractedFieldsRaw === 'string') {
      try {
        const aiExtractedFields: Record<string, string> =
          JSON.parse(aiExtractedFieldsRaw)
        const applicantCorrections: Array<{
          fieldName: string
          aiExtractedValue: string
          applicantSubmittedValue: string
        }> = []

        const camelToSnake: Record<string, string> = {
          brandName: 'brand_name',
          fancifulName: 'fanciful_name',
          classType: 'class_type',
          alcoholContent: 'alcohol_content',
          netContents: 'net_contents',
          nameAndAddress: 'name_and_address',
          qualifyingPhrase: 'qualifying_phrase',
          countryOfOrigin: 'country_of_origin',
          grapeVarietal: 'grape_varietal',
          appellationOfOrigin: 'appellation_of_origin',
          vintageYear: 'vintage_year',
          ageStatement: 'age_statement',
          stateOfDistillation: 'state_of_distillation',
        }

        for (const [camelKey, snakeKey] of Object.entries(camelToSnake)) {
          const aiValue = aiExtractedFields[snakeKey]
          if (!aiValue) continue
          const submittedValue =
            (input[camelKey as keyof typeof input] as string) ?? ''
          if (submittedValue && submittedValue.trim() !== aiValue.trim()) {
            applicantCorrections.push({
              fieldName: snakeKey,
              aiExtractedValue: aiValue,
              applicantSubmittedValue: submittedValue.trim(),
            })
          }
        }

        if (applicantCorrections.length > 0) {
          aiRawResponseWithCorrections = {
            ...aiRawResponseWithCorrections,
            applicantCorrections,
          }
        }
      } catch {
        // Invalid JSON — skip correction delta
      }
    }

    // 11. Create validation result record
    const [validationResult] = await db
      .insert(validationResults)
      .values({
        labelId: label.id,
        aiRawResponse: aiRawResponseWithCorrections,
        processingTimeMs: extraction.processingTimeMs,
        modelUsed: extraction.modelUsed,
        inputTokens: extraction.metrics.inputTokens,
        outputTokens: extraction.metrics.outputTokens,
        totalTokens: extraction.metrics.totalTokens,
        isCurrent: true,
      })
      .returning({ id: validationResults.id })

    // 12. Create validation item records
    if (fieldComparisons.length > 0) {
      await db.insert(validationItems).values(
        fieldComparisons.map((comp) => {
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

    // 13. Determine overall status
    const itemStatuses = fieldComparisons.map((comp) => ({
      fieldName: comp.fieldName,
      status: comp.status,
    }))

    const { status: overallStatus } = determineOverallStatus(
      itemStatuses,
      input.beverageType,
      input.containerSizeMl,
    )

    // 14. Calculate overall confidence
    const confidences = fieldComparisons.map((c) => c.confidence)
    const overallConfidence =
      confidences.length > 0
        ? Math.round(
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
          )
        : 0

    // 15. Update label with final status and confidence
    // Only auto-approve when the setting is enabled; otherwise route all labels through specialist review
    const autoApprovalEnabled = await getAutoApprovalEnabled()

    if (autoApprovalEnabled && overallStatus === 'approved') {
      await db
        .update(labels)
        .set({
          status: 'approved',
          overallConfidence: String(overallConfidence),
        })
        .where(eq(labels.id, label.id))
    } else {
      await db
        .update(labels)
        .set({
          status: 'pending_review',
          aiProposedStatus: overallStatus,
          overallConfidence: String(overallConfidence),
        })
        .where(eq(labels.id, label.id))
    }

    const finalStatus =
      autoApprovalEnabled && overallStatus === 'approved'
        ? ('approved' as const)
        : ('pending_review' as const)

    return { success: true, labelId: label.id, status: finalStatus }
  } catch (error) {
    console.error('[submitApplication] Unexpected error:', error)

    // Best-effort: reset partially-created label to pending so it can be retried
    if (labelId) {
      try {
        await db
          .update(labels)
          .set({ status: 'pending' })
          .where(eq(labels.id, labelId))
      } catch {
        // Cleanup failed — label stays in 'processing' state
      }
    }

    if (error instanceof PipelineTimeoutError) {
      return {
        success: false,
        error:
          'Analysis is taking longer than expected. Your submission has been saved and will continue processing.',
        timeout: true,
      }
    }

    return {
      success: false,
      error: 'An unexpected error occurred during submission',
    }
  }
}
