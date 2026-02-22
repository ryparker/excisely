import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

import { buildClassificationPrompt } from '@/lib/ai/prompts'

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

const classificationResultSchema = z.object({
  fields: z.array(classifiedFieldSchema),
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
 */
export async function classifyFields(
  ocrText: string,
  beverageType: string,
  wordList: Array<{ index: number; text: string }>,
): Promise<ClassificationResponse> {
  const prompt = buildClassificationPrompt(ocrText, beverageType, wordList)

  const { experimental_output, usage } = await generateText({
    model: openai('gpt-5-mini'),
    prompt,
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
