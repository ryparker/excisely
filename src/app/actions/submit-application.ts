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
import { fetchImageBytes } from '@/lib/storage/blob'
import { guardApplicant } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { logActionError } from '@/lib/actions/action-error'
import { parseImageUrls } from '@/lib/actions/parse-image-urls'
import {
  validateLabelSchema,
  type ValidateLabelInput,
} from '@/lib/validators/label-schema'
import { buildExpectedFields } from '@/lib/labels/validation-helpers'
import { runValidationPipeline } from '@/lib/actions/validation-pipeline'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubmitApplicationResult =
  | { success: true; labelId: string; status: 'approved' | 'pending_review' }
  | { success: false; error: string; timeout?: boolean }

// ---------------------------------------------------------------------------
// Core — reusable by submitApplication and batchSubmitRow
// ---------------------------------------------------------------------------

export async function submitApplicationCore(input: {
  applicantEmail: string
  data: ValidateLabelInput
  imageUrls: string[]
  rawResponseTransform?: (raw: unknown) => unknown
}): Promise<SubmitApplicationResult> {
  const { applicantEmail, data, imageUrls, rawResponseTransform } = input

  let labelId: string | null = null

  try {
    // 1. Start fetching image bytes NOW — overlaps with DB writes below (~150ms saved)
    const imageBuffersPromise = Promise.all(imageUrls.map(fetchImageBytes))

    // 2. Resolve applicant ID by email
    const applicantRecord = await getApplicantByEmail(applicantEmail)
    const applicantId = applicantRecord?.id ?? null

    // 3. Create label record with status "processing"
    const label = await insertLabel({
      specialistId: null,
      applicantId,
      beverageType: data.beverageType,
      containerSizeMl: data.containerSizeMl,
      status: 'processing',
    })

    labelId = label.id

    // 4. Create application data record
    await insertApplicationData({
      labelId: label.id,
      serialNumber: data.serialNumber || null,
      brandName: data.brandName,
      fancifulName: data.fancifulName || null,
      classType: data.classType || null,
      classTypeCode: data.classTypeCode || null,
      alcoholContent: data.alcoholContent || null,
      netContents: data.netContents || null,
      healthWarning: data.healthWarning || null,
      nameAndAddress: data.nameAndAddress || null,
      qualifyingPhrase: data.qualifyingPhrase || null,
      countryOfOrigin: data.countryOfOrigin || null,
      grapeVarietal: data.grapeVarietal || null,
      appellationOfOrigin: data.appellationOfOrigin || null,
      vintageYear: data.vintageYear || null,
      sulfiteDeclaration: data.sulfiteDeclaration ?? null,
      ageStatement: data.ageStatement || null,
      stateOfDistillation: data.stateOfDistillation || null,
    })

    // 5. Create label image records
    const imageRecords = await insertLabelImages(
      imageUrls.map((url, index) => ({
        labelId: label.id,
        imageUrl: url,
        imageFilename: url.split('/').pop() ?? `image-${index}`,
        imageType: index === 0 ? ('front' as const) : ('other' as const),
        sortOrder: index,
      })),
    )

    // 6. Await pre-fetched image buffers (started before DB writes)
    const preloadedBuffers = await imageBuffersPromise

    // 7. Run shared AI validation pipeline (with pre-fetched buffers)
    const expectedFields = buildExpectedFields(data, data.beverageType)
    const result = await runValidationPipeline({
      labelId: label.id,
      imageUrls,
      imageRecordIds: imageRecords.map((r) => r.id),
      beverageType: data.beverageType,
      containerSizeMl: data.containerSizeMl,
      expectedFields,
      rawResponseTransform,
      preloadedBuffers,
    })

    // 8. Update label with final status
    await updateLabelStatus(label.id, {
      status: 'pending_review',
      aiProposedStatus: result.overallStatus,
      overallConfidence: String(result.overallConfidence),
    })

    // 9. Invalidate caches
    updateTag('labels')
    updateTag('sla-metrics')

    return { success: true, labelId: label.id, status: 'pending_review' }
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
      console.error('[submitApplicationCore] Pipeline timeout:', error)
      return {
        success: false,
        error:
          'Analysis is taking longer than expected. Your submission has been saved and will continue processing.',
        timeout: true,
      }
    }

    return logActionError(
      'submitApplicationCore',
      error,
      'An unexpected error occurred during submission',
    )
  }
}

// ---------------------------------------------------------------------------
// Server Action — thin wrapper over submitApplicationCore
// ---------------------------------------------------------------------------

export async function submitApplication(
  formData: FormData,
): Promise<SubmitApplicationResult> {
  // 1. Authenticate — only applicants can submit
  const guard = await guardApplicant()
  if (!guard.success) return guard
  const { session } = guard

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
    qualifyingPhrase: (formData.get('qualifyingPhrase') as string) || undefined,
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

  const data = parsed.data

  // 3. Extract and validate image URLs
  const imageUrlsResult = parseImageUrls(formData)
  if (!imageUrlsResult.success) return imageUrlsResult
  const { imageUrls } = imageUrlsResult

  // 4. Build applicant corrections transform for rawResponse
  const rawResponseTransform = buildApplicantCorrectionsTransform(
    formData,
    data,
  )

  // 5. Delegate to core
  return submitApplicationCore({
    applicantEmail: session.user.email,
    data,
    imageUrls,
    rawResponseTransform,
  })
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
