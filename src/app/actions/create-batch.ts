'use server'

import { z } from 'zod'

import { db } from '@/db'
import { applicationData, batches, labelImages, labels } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { validateImageUrl } from '@/lib/validators/file-schema'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createBatchSchema = z.object({
  name: z.string().optional(),
  applicantId: z.string().optional(),
  beverageType: z.enum(['distilled_spirits', 'wine', 'malt_beverage']),
  containerSizeMl: z.number().int().positive(),
  imageUrls: z.array(z.string().url()).min(1, 'At least one image is required'),
  // Shared application data
  classTypeCode: z.string().optional(),
  serialNumber: z.string().optional(),
  brandName: z.string().min(1, 'Brand Name is required'),
  fancifulName: z.string().optional(),
  classType: z.string().optional(),
  alcoholContent: z.string().optional(),
  netContents: z.string().optional(),
  healthWarning: z.string().optional(),
  nameAndAddress: z.string().optional(),
  qualifyingPhrase: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  grapeVarietal: z.string().optional(),
  appellationOfOrigin: z.string().optional(),
  vintageYear: z.string().optional(),
  sulfiteDeclaration: z.boolean().optional(),
  ageStatement: z.string().optional(),
  stateOfDistillation: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateBatchResult =
  | { success: true; batchId: string }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function createBatch(
  formData: FormData,
): Promise<CreateBatchResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    // Parse form data
    let imageUrls: string[]
    try {
      imageUrls = JSON.parse(formData.get('imageUrls') as string)
    } catch {
      return { success: false, error: 'Invalid image URLs format' }
    }

    const rawData = {
      name: (formData.get('name') as string) || undefined,
      applicantId: (formData.get('applicantId') as string) || undefined,
      beverageType: formData.get('beverageType') as string,
      containerSizeMl: Number(formData.get('containerSizeMl')),
      imageUrls,
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

    const parsed = createBatchSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return {
        success: false,
        error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
      }
    }

    const input = parsed.data

    // Validate all image URLs point to Vercel Blob
    for (const url of input.imageUrls) {
      if (!validateImageUrl(url)) {
        return { success: false, error: `Invalid image URL: ${url}` }
      }
    }

    // Create batch record
    const [batch] = await db
      .insert(batches)
      .values({
        specialistId: session.user.id,
        applicantId: input.applicantId || null,
        name: input.name || null,
        status: 'processing',
        totalLabels: input.imageUrls.length,
        processedCount: 0,
        approvedCount: 0,
        conditionallyApprovedCount: 0,
        rejectedCount: 0,
        needsCorrectionCount: 0,
      })
      .returning({ id: batches.id })

    // Create a label + application_data + label_image for each image URL
    for (let i = 0; i < input.imageUrls.length; i++) {
      const imageUrl = input.imageUrls[i]

      const [label] = await db
        .insert(labels)
        .values({
          specialistId: session.user.id,
          applicantId: input.applicantId || null,
          batchId: batch.id,
          beverageType: input.beverageType,
          containerSizeMl: input.containerSizeMl,
          status: 'pending',
        })
        .returning({ id: labels.id })

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

      await db.insert(labelImages).values({
        labelId: label.id,
        imageUrl,
        imageFilename: imageUrl.split('/').pop() ?? `image-${i}`,
        imageType: 'front',
        sortOrder: 0,
      })
    }

    return { success: true, batchId: batch.id }
  } catch (error) {
    console.error('[createBatch] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while creating the batch',
    }
  }
}
