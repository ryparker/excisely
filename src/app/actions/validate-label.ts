'use server'

import {
  insertLabel,
  insertApplicationData,
  insertLabelImages,
  updateLabelStatus,
} from '@/db/mutations/labels'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { parseImageUrls } from '@/lib/actions/parse-image-urls'
import { validateLabelSchema } from '@/lib/validators/label-schema'
import { buildExpectedFields } from '@/lib/labels/validation-helpers'
import { runValidationPipeline } from '@/lib/actions/validation-pipeline'
import { logActionError } from '@/lib/actions/action-error'
import type { ActionResult } from '@/lib/actions/result-types'

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function validateLabel(
  formData: FormData,
): Promise<ActionResult<{ labelId: string }>> {
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

    // 7. Run shared AI validation pipeline
    const expectedFields = buildExpectedFields(input, input.beverageType)
    const result = await runValidationPipeline({
      labelId: label.id,
      imageUrls,
      imageRecordIds: imageRecords.map((r) => r.id),
      beverageType: input.beverageType,
      containerSizeMl: input.containerSizeMl,
      expectedFields,
    })

    // 8. Update label with final status
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

    return { success: true, labelId: label.id }
  } catch (error) {
    return logActionError(
      'validateLabel',
      error,
      'An unexpected error occurred during validation',
    )
  }
}
