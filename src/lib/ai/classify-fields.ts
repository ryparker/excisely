import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

import type { BeverageType } from '@/config/beverage-types'
import {
  buildClassificationPrompt,
  buildExtractionPrompt,
  buildFastExtractionMessages,
  buildSubmissionClassificationPrompt,
} from '@/lib/ai/prompts'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const classifiedFieldSchema = z.object({
  fieldName: z.string(),
  value: z.string().nullable(),
  confidence: z.number(),
  wordIndices: z.array(z.number()),
  reasoning: z.string().nullable(),
})

const imageClassificationSchema = z.object({
  imageIndex: z.number(),
  imageType: z.enum(['front', 'back', 'neck', 'strip', 'other']),
  confidence: z.number(),
})

const classificationResultSchema = z.object({
  fields: z.array(classifiedFieldSchema),
  imageClassifications: z.array(imageClassificationSchema),
  detectedBeverageType: z
    .enum(['distilled_spirits', 'wine', 'malt_beverage'])
    .nullable(),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassifiedField = z.infer<typeof classifiedFieldSchema>
export type ClassificationResult = z.infer<typeof classificationResultSchema>

export interface ClassificationResponse {
  result: ClassificationResult
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classifies OCR-extracted text into TTB-regulated label fields
 * using GPT-5 Mini with structured output.
 *
 * When image buffers are provided, the model receives both the OCR text
 * and the original images so it can visually verify extracted values —
 * especially numeric fields like alcohol content where OCR can misread digits.
 */
export async function classifyFields(
  ocrText: string,
  beverageType: BeverageType,
  wordList: Array<{ index: number; text: string }>,
  applicationData?: Record<string, string>,
  imageBuffers?: Buffer[],
): Promise<ClassificationResponse> {
  const prompt = buildClassificationPrompt(
    ocrText,
    beverageType,
    wordList,
    applicationData,
  )

  // Build multimodal messages: images first (so the model "sees" them),
  // then the text prompt with OCR data and instructions.
  const content: Array<
    | { type: 'image'; image: Buffer; mimeType: 'image/png' | 'image/jpeg' }
    | { type: 'text'; text: string }
  > = []

  if (imageBuffers && imageBuffers.length > 0) {
    for (const buf of imageBuffers) {
      content.push({ type: 'image', image: buf, mimeType: 'image/jpeg' })
    }
  }

  content.push({ type: 'text', text: prompt })

  const { experimental_output, usage } = await generateText({
    model: openai('gpt-5-mini'),
    messages: [{ role: 'user', content }],
    experimental_output: Output.object({
      schema: classificationResultSchema,
    }),
  })

  if (!experimental_output) {
    throw new Error(
      'Classification returned no structured output. The model may have refused or produced invalid JSON.',
    )
  }

  return {
    result: experimental_output,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Fast extraction (applicant pre-fill — minimal schema, text-only)
// ---------------------------------------------------------------------------

/** Minimal field schema: just name + value. No wordIndices, confidence, or reasoning. */
const minimalFieldSchema = z.object({
  fieldName: z.string(),
  value: z.string(),
})

const fastExtractionResultSchema = z.object({
  fields: z.array(minimalFieldSchema),
})

/**
 * Ultra-fast beverage-type-aware extraction for applicant pre-fill.
 * Optimized for speed over accuracy — the applicant reviews & corrects.
 * - GPT-4.1 for fast inference (non-reasoning model, ~3-8s)
 * - System/user message split for OpenAI prompt caching
 * - Minimal schema: just fieldName + value
 * - Skips health_warning (auto-filled) and standards_of_fill (computed)
 * - No images, no word list, no reasoning
 */
export async function classifyFieldsForExtraction(
  ocrText: string,
  beverageType: BeverageType,
): Promise<ClassificationResponse> {
  const { system, user } = buildFastExtractionMessages(ocrText, beverageType)

  const { experimental_output, usage } = await generateText({
    model: openai('gpt-4.1'),
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    experimental_output: Output.object({
      schema: fastExtractionResultSchema,
    }),
  })

  if (!experimental_output) {
    throw new Error(
      'Extraction returned no structured output. The model may have refused or produced invalid JSON.',
    )
  }

  // Adapt minimal result to full ClassificationResult shape
  const fields: ClassifiedField[] = experimental_output.fields.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: 80,
    wordIndices: [],
    reasoning: null,
  }))

  return {
    result: {
      fields,
      imageClassifications: [],
      detectedBeverageType: beverageType as
        | 'distilled_spirits'
        | 'wine'
        | 'malt_beverage',
    },
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Submission classification (gpt-5-mini, text-only, with reasoning)
// ---------------------------------------------------------------------------

/** Submission schema: confidence + reasoning but no wordIndices (local text matching handles bboxes) */
const submissionFieldSchema = z.object({
  fieldName: z.string(),
  value: z.string().nullable(),
  confidence: z.number(),
  reasoning: z.string().nullable(),
})

const submissionResultSchema = z.object({
  fields: z.array(submissionFieldSchema),
})

/**
 * Submission-optimized classification using gpt-5-mini (text-only).
 * Keeps reasoning quality for specialist confidence levels while dropping
 * multimodal image overhead (~30-40s savings).
 *
 * - Model: gpt-5-mini (reasoning model)
 * - Text-only (no image buffers)
 * - System/user message split for OpenAI prompt caching
 * - Returns confidence + reasoning per field (no wordIndices)
 */
export async function classifyFieldsForSubmission(
  ocrText: string,
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
): Promise<ClassificationResponse> {
  const { system, user } = buildSubmissionClassificationPrompt(
    ocrText,
    beverageType,
    applicationData,
  )

  const { experimental_output, usage } = await generateText({
    model: openai('gpt-5-mini'),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    providerOptions: {
      openai: { reasoningEffort: 'low' },
    },
    experimental_output: Output.object({
      schema: submissionResultSchema,
    }),
  })

  if (!experimental_output) {
    throw new Error(
      'Submission classification returned no structured output. The model may have refused or produced invalid JSON.',
    )
  }

  // Adapt to full ClassificationResult shape
  const fields: ClassifiedField[] = experimental_output.fields.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: f.confidence,
    wordIndices: [],
    reasoning: f.reasoning,
  }))

  return {
    result: {
      fields,
      imageClassifications: [],
      detectedBeverageType: beverageType as
        | 'distilled_spirits'
        | 'wine'
        | 'malt_beverage',
    },
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Full extraction (no beverage type — union of all fields)
// ---------------------------------------------------------------------------

/**
 * Extraction-only classification: no beverage type required.
 * Uses the extraction prompt that asks the model to detect beverage type.
 */
export async function extractFieldsOnly(
  ocrText: string,
  wordList: Array<{ index: number; text: string }>,
  imageBuffers?: Buffer[],
): Promise<ClassificationResponse> {
  const prompt = buildExtractionPrompt(ocrText, wordList)

  const content: Array<
    | { type: 'image'; image: Buffer; mimeType: 'image/png' | 'image/jpeg' }
    | { type: 'text'; text: string }
  > = []

  if (imageBuffers && imageBuffers.length > 0) {
    for (const buf of imageBuffers) {
      content.push({ type: 'image', image: buf, mimeType: 'image/jpeg' })
    }
  }

  content.push({ type: 'text', text: prompt })

  const { experimental_output, usage } = await generateText({
    model: openai('gpt-5-mini'),
    messages: [{ role: 'user', content }],
    experimental_output: Output.object({
      schema: classificationResultSchema,
    }),
  })

  if (!experimental_output) {
    throw new Error(
      'Extraction returned no structured output. The model may have refused or produced invalid JSON.',
    )
  }

  return {
    result: experimental_output,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    },
  }
}
