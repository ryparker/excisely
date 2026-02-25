import type { BeverageType } from '@/config/beverage-types'
import { ruleClassify } from '@/lib/ai/rule-classify'
import { isLlmAvailable, llmExtractFields } from '@/lib/ai/openai-extract'

// ---------------------------------------------------------------------------
// Types (unchanged — downstream consumers depend on this interface)
// ---------------------------------------------------------------------------

export interface ClassifiedField {
  fieldName: string
  value: string | null
  confidence: number
  wordIndices: number[]
  reasoning: string | null
}

export interface ClassificationResult {
  fields: ClassifiedField[]
  imageClassifications: Array<{
    imageIndex: number
    imageType: 'front' | 'back' | 'neck' | 'strip' | 'other'
    confidence: number
  }>
  detectedBeverageType:
    | 'distilled_spirits'
    | 'wine'
    | 'malt_beverage'
    | null
}

export interface ClassificationResponse {
  result: ClassificationResult
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

// ---------------------------------------------------------------------------
// Zero-cost usage (no LLM = no tokens)
// ---------------------------------------------------------------------------

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

// ---------------------------------------------------------------------------
// Classification (rule-based — replaces OpenAI calls)
// ---------------------------------------------------------------------------

/**
 * Classifies OCR-extracted text into TTB-regulated label fields
 * using rule-based matching (regex, dictionary, fuzzy search).
 *
 * Replaces the previous GPT-5 Mini multimodal classification.
 * Same interface — zero outbound API calls.
 */
export async function classifyFields(
  ocrText: string,
  beverageType: BeverageType,
  _wordList: Array<{ index: number; text: string }>,
  applicationData?: Record<string, string>,
  _imageBuffers?: Buffer[],
): Promise<ClassificationResponse> {
  const result = ruleClassify(ocrText, beverageType, applicationData)
  return { result, usage: ZERO_USAGE }
}

/**
 * Beverage-type-aware extraction for applicant pre-fill.
 * Auto-upgrades to GPT-4.1-mini when OPENAI_API_KEY is set,
 * with rule-based fallback on error or when key is absent.
 */
export async function classifyFieldsForExtraction(
  ocrText: string,
  beverageType: BeverageType,
): Promise<ClassificationResponse> {
  if (isLlmAvailable()) {
    try {
      return await llmExtractFields(ocrText, beverageType)
    } catch {
      // LLM failed — fall back to rule-based extraction
    }
  }
  const result = ruleClassify(ocrText, beverageType)
  return { result, usage: ZERO_USAGE }
}

/**
 * Submission-optimized classification using rule-based matching.
 * Previously used GPT-4.1 text-only. Now uses fuzzy text search (~5ms).
 * The comparison engine determines match/mismatch outcomes independently.
 */
export async function classifyFieldsForSubmission(
  ocrText: string,
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
): Promise<ClassificationResponse> {
  const result = ruleClassify(ocrText, beverageType, applicationData)
  return { result, usage: ZERO_USAGE }
}

/**
 * Extraction-only classification: no beverage type required.
 * Auto-upgrades to GPT-4.1-mini when OPENAI_API_KEY is set,
 * with rule-based fallback on error or when key is absent.
 */
export async function extractFieldsOnly(
  ocrText: string,
  _wordList: Array<{ index: number; text: string }>,
  _imageBuffers?: Buffer[],
): Promise<ClassificationResponse> {
  if (isLlmAvailable()) {
    try {
      return await llmExtractFields(ocrText, null)
    } catch {
      // LLM failed — fall back to rule-based extraction
    }
  }
  const result = ruleClassify(ocrText, null)
  return { result, usage: ZERO_USAGE }
}
