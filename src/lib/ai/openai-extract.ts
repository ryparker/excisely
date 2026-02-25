import OpenAI from 'openai'
import { z } from 'zod'
import type { BeverageType } from '@/config/beverage-types'
import { BEVERAGE_TYPES } from '@/config/beverage-types'
import { FIELD_DESCRIPTIONS } from '@/lib/ai/prompts'
import type { ClassificationResponse } from '@/lib/ai/classify-fields'

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

/**
 * Returns true when the OpenAI API key is configured.
 * Used to auto-upgrade applicant pre-fill from rule-based to LLM extraction.
 */
export function isLlmAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

// ---------------------------------------------------------------------------
// Lazy singleton client
// ---------------------------------------------------------------------------

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10_000,
    })
  }
  return _client
}

/** @internal Inject or reset cached client — for tests */
export function _setClient(client: OpenAI | null): void {
  _client = client
}

// ---------------------------------------------------------------------------
// Response schema (Zod validation of LLM output)
// ---------------------------------------------------------------------------

const LlmFieldSchema = z.object({
  fieldName: z.string(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().nullable(),
})

const LlmResponseSchema = z.object({
  fields: z.array(LlmFieldSchema),
  detectedBeverageType: z
    .enum(['distilled_spirits', 'wine', 'malt_beverage'])
    .nullable()
    .optional(),
})

type LlmResponse = z.infer<typeof LlmResponseSchema>

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildFieldList(beverageType: BeverageType | null): string[] {
  if (beverageType) {
    const config = BEVERAGE_TYPES[beverageType]
    return [...config.mandatoryFields, ...config.optionalFields]
  }
  // Union of all fields when type is unknown
  const allFields = new Set<string>()
  for (const config of Object.values(BEVERAGE_TYPES)) {
    for (const f of config.mandatoryFields) allFields.add(f)
    for (const f of config.optionalFields) allFields.add(f)
  }
  return [...allFields]
}

function buildSystemPrompt(): string {
  return `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label analysis expert.

Your task is to extract structured field values from OCR text of alcohol beverage labels.

Key rules:
- brand_name is the primary trademarked name consumers know the product by (e.g., "Bulleit", "Jack Daniel's", "Smirnoff"). It is usually the LARGEST, most prominent text on the front label.
- fanciful_name is an OPTIONAL secondary/creative name for a specific product variant (e.g., "Frontier Whiskey", "Single Barrel Select", "Old Fashioned"). It is NOT the brand name and NOT the class/type. Many products do not have a fanciful name — return null if none exists.
- A grape varietal name (like "Cabernet Sauvignon") is NOT a fanciful name — it belongs in grape_varietal.
- class_type is the LEGAL product category (e.g., "Bourbon Whiskey", "Table Wine", "India Pale Ale"), not a marketing name.
- health_warning must start with "GOVERNMENT WARNING:" in all caps.
- qualifying_phrase is the phrase before the producer name/address (e.g., "Bottled by", "Produced and Bottled by"). Normalize "&" to "and".
- Return null for fields not present on the label. Do not guess or fabricate values.
- confidence should reflect how certain you are: 90-100 for clear matches, 70-89 for likely matches, below 70 for uncertain.

Respond with valid JSON matching this exact structure:
{
  "fields": [
    { "fieldName": "<field_name>", "value": "<extracted_value or null>", "confidence": <0-100>, "reasoning": "<brief explanation>" }
  ],
  "detectedBeverageType": "<distilled_spirits|wine|malt_beverage|null>"
}`
}

function buildUserPrompt(
  ocrText: string,
  beverageType: BeverageType | null,
  fieldNames: string[],
): string {
  const fieldDescriptions = fieldNames
    .map((name) => {
      const desc = FIELD_DESCRIPTIONS[name] ?? name
      return `- **${name}**: ${desc}`
    })
    .join('\n')

  const typeHint = beverageType
    ? `\nBeverage type: ${BEVERAGE_TYPES[beverageType].label}`
    : '\nBeverage type: Unknown (detect from label text)'

  return `Extract the following fields from this alcohol label OCR text.
${typeHint}

## Fields to extract:
${fieldDescriptions}

## OCR Text:
${ocrText}`
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

/**
 * Extract label fields using GPT-4.1-mini with structured JSON output.
 * Text-only (no images) — receives OCR text from Tesseract.js.
 *
 * @returns ClassificationResponse with token usage for metrics tracking
 */
export async function llmExtractFields(
  ocrText: string,
  beverageType: BeverageType | null,
): Promise<ClassificationResponse> {
  const client = getClient()
  const fieldNames = buildFieldList(beverageType)

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserPrompt(ocrText, beverageType, fieldNames),
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('GPT-4.1-mini returned empty response')
  }

  // Parse and validate with Zod
  const parsed: unknown = JSON.parse(content)
  const validated: LlmResponse = LlmResponseSchema.parse(parsed)

  // Map to ClassificationResponse interface
  const usage = response.usage
  return {
    result: {
      fields: validated.fields.map((f) => ({
        fieldName: f.fieldName,
        value: f.value,
        confidence: f.confidence,
        wordIndices: [],
        reasoning: f.reasoning,
      })),
      imageClassifications: [],
      detectedBeverageType:
        (validated.detectedBeverageType as
          | 'distilled_spirits'
          | 'wine'
          | 'malt_beverage'
          | null) ?? null,
    },
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  }
}
