'use server'

import { z } from 'zod'

import { guardAuth } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import {
  extractLabelFieldsForApplicantWithType,
  extractLabelFieldsWithAutoDetect,
} from '@/lib/ai/extract-label'
import { validateImageUrl } from '@/lib/validators/file-schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplicantExtractedField {
  fieldName: string
  value: string | null
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  } | null
  imageIndex: number
}

interface ExtractFieldsResult {
  fields: ApplicantExtractedField[]
  imageClassifications: Array<{
    imageIndex: number
    imageType: 'front' | 'back' | 'neck' | 'strip' | 'other'
    confidence: number
  }>
  detectedBeverageType: string | null
}

type ExtractFieldsResponse =
  | { success: true; data: ExtractFieldsResult }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  imageUrls: z
    .array(z.string().url())
    .min(1, 'At least one image URL is required')
    .max(10, 'Maximum 10 images'),
  beverageType: z
    .enum(['distilled_spirits', 'wine', 'malt_beverage'])
    .optional(),
})

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function extractFieldsFromImage(input: {
  imageUrls: string[]
  beverageType?: string
}): Promise<ExtractFieldsResponse> {
  const guard = await guardAuth()
  if (!guard.success) return guard

  try {
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: formatZodError(parsed.error) }
    }

    for (const url of parsed.data.imageUrls) {
      if (!validateImageUrl(url)) {
        return { success: false, error: `Invalid image URL: ${url}` }
      }
    }

    const extraction = parsed.data.beverageType
      ? await extractLabelFieldsForApplicantWithType(
          parsed.data.imageUrls,
          parsed.data.beverageType,
        )
      : await extractLabelFieldsWithAutoDetect(parsed.data.imageUrls)

    // Strip internal fields (confidence, reasoning, angle, rawResponse, metrics)
    const fields: ApplicantExtractedField[] = extraction.fields
      .filter((f) => f.value !== null)
      .map((f) => ({
        fieldName: f.fieldName,
        value: f.value,
        boundingBox: f.boundingBox
          ? {
              x: f.boundingBox.x,
              y: f.boundingBox.y,
              width: f.boundingBox.width,
              height: f.boundingBox.height,
            }
          : null,
        imageIndex: f.imageIndex,
      }))

    return {
      success: true,
      data: {
        fields,
        imageClassifications: extraction.imageClassifications,
        detectedBeverageType: extraction.detectedBeverageType,
      },
    }
  } catch (error) {
    console.error('[extractFieldsFromImage] Error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during field extraction',
    }
  }
}
