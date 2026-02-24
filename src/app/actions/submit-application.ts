'use server'

import { updateTag } from 'next/cache'
import { after } from 'next/server'

import { getApplicantByEmail } from '@/db/queries/applicants'
import {
  insertLabel,
  insertApplicationData,
  insertLabelImages,
  updateLabelStatus,
} from '@/db/mutations/labels'
import { PipelineTimeoutError } from '@/lib/ai/extract-label'
import { guardApplicant } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { logActionError } from '@/lib/actions/action-error'
import { parseImageUrls } from '@/lib/actions/parse-image-urls'
import { validateLabelSchema } from '@/lib/validators/label-schema'
import { buildExpectedFields } from '@/lib/labels/validation-helpers'
import { runValidationPipeline } from '@/lib/actions/validation-pipeline'

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
  const guard = await guardApplicant()
  if (!guard.success) return guard
  const { session } = guard

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
      return { success: false, error: formatZodError(parsed.error) }
    }

    const input = parsed.data

    // 3. Extract and validate image URLs
    const imageUrlsResult = parseImageUrls(formData)
    if (!imageUrlsResult.success) return imageUrlsResult
    const { imageUrls } = imageUrlsResult

    // 4. Look up applicant record by contactEmail matching session user's email
    const applicantRecord = await getApplicantByEmail(session.user.email)

    // 5. Create label record with status "processing" — no specialist assigned yet
    const label = await insertLabel({
      specialistId: null,
      applicantId: applicantRecord?.id ?? null,
      beverageType: input.beverageType,
      containerSizeMl: input.containerSizeMl,
      status: 'processing',
    })

    labelId = label.id

    // 6. Create application data record
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

    // 7. Create label image records
    const imageRecords = await insertLabelImages(
      imageUrls.map((url, index) => ({
        labelId: label.id,
        imageUrl: url,
        imageFilename: url.split('/').pop() ?? `image-${index}`,
        imageType: index === 0 ? ('front' as const) : ('other' as const),
        sortOrder: index,
      })),
    )

    // 8. Build applicant corrections transform for rawResponse
    const rawResponseTransform = buildApplicantCorrectionsTransform(
      formData,
      input,
    )

    // 9. Run shared AI validation pipeline
    const expectedFields = buildExpectedFields(input, input.beverageType)
    const result = await runValidationPipeline({
      labelId: label.id,
      imageUrls,
      imageRecordIds: imageRecords.map((r) => r.id),
      beverageType: input.beverageType,
      containerSizeMl: input.containerSizeMl,
      expectedFields,
      rawResponseTransform,
    })

    // 10. Update label with final status
    if (result.autoApproved) {
      await updateLabelStatus(label.id, {
        status: 'approved',
        overallConfidence: String(result.overallConfidence),
      })
    } else {
      await updateLabelStatus(label.id, {
        status: 'pending_review',
        aiProposedStatus: result.overallStatus,
        overallConfidence: String(result.overallConfidence),
      })
    }

    const finalStatus = result.autoApproved
      ? ('approved' as const)
      : ('pending_review' as const)

    updateTag('labels')
    updateTag('sla-metrics')

    return { success: true, labelId: label.id, status: finalStatus }
  } catch (error) {
    // Best-effort: reset partially-created label to pending so it can be retried
    if (labelId) {
      const failedLabelId = labelId
      after(async () => {
        try {
          await updateLabelStatus(failedLabelId, { status: 'pending' })
        } catch {
          // Cleanup failed — label stays in 'processing' state
        }
      })
    }

    if (error instanceof PipelineTimeoutError) {
      console.error('[submitApplication] Pipeline timeout:', error)
      return {
        success: false,
        error:
          'Analysis is taking longer than expected. Your submission has been saved and will continue processing.',
        timeout: true,
      }
    }

    return logActionError(
      'submitApplication',
      error,
      'An unexpected error occurred during submission',
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a rawResponse transform that appends applicant correction deltas.
 * Returns undefined if no corrections were made.
 */
function buildApplicantCorrectionsTransform(
  formData: FormData,
  input: Record<string, unknown>,
): ((raw: unknown) => unknown) | undefined {
  const aiExtractedFieldsRaw = formData.get('aiExtractedFields')
  if (!aiExtractedFieldsRaw || typeof aiExtractedFieldsRaw !== 'string') {
    return undefined
  }

  let aiExtractedFields: Record<string, string>
  try {
    aiExtractedFields = JSON.parse(aiExtractedFieldsRaw)
  } catch {
    return undefined
  }

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

  const applicantCorrections: Array<{
    fieldName: string
    aiExtractedValue: string
    applicantSubmittedValue: string
  }> = []

  for (const [camelKey, snakeKey] of Object.entries(camelToSnake)) {
    const aiValue = aiExtractedFields[snakeKey]
    if (!aiValue) continue
    const submittedValue = (input[camelKey] as string) ?? ''
    if (submittedValue && submittedValue.trim() !== aiValue.trim()) {
      applicantCorrections.push({
        fieldName: snakeKey,
        aiExtractedValue: aiValue,
        applicantSubmittedValue: submittedValue.trim(),
      })
    }
  }

  if (applicantCorrections.length === 0) return undefined

  return (raw: unknown) => ({
    ...(raw as Record<string, unknown>),
    applicantCorrections,
  })
}
