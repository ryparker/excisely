import { extractTextMultiImage } from '@/lib/ai/ocr'
import {
  classifyFields,
  classifyFieldsForExtraction,
  classifyFieldsForSubmission,
  extractFieldsOnly,
} from '@/lib/ai/classify-fields'
import { fetchImageBytes } from '@/lib/storage/blob'
import type { BeverageType } from '@/config/beverage-types'

import {
  buildCombinedWordList,
  matchFieldsToBoundingBoxes,
  mergeFieldsWithBoundingBoxes,
} from '@/lib/ai/text-matching'
import { classifyImagesFromOcr } from '@/lib/ai/image-classifier'
import { detectBeverageTypeFromText } from '@/lib/ai/beverage-detector'

// Re-export for external consumers
export { detectBeverageTypeFromText } from '@/lib/ai/beverage-detector'

// ---------------------------------------------------------------------------
// Pipeline timeout
// ---------------------------------------------------------------------------

export const PIPELINE_TIMEOUT_MS = 15_000

export class PipelineTimeoutError extends Error {
  constructor() {
    super(`AI pipeline timed out after ${PIPELINE_TIMEOUT_MS / 1000} seconds`)
    this.name = 'PipelineTimeoutError'
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedField {
  fieldName: string
  value: string | null
  confidence: number
  reasoning: string | null
  boundingBox: {
    x: number // normalized 0-1
    y: number // normalized 0-1
    width: number // normalized 0-1
    height: number // normalized 0-1
    angle: number // dominant text reading angle in degrees (0, 90, -90, 180)
  } | null
  imageIndex: number // which image this field was found on
}

export interface PipelineMetrics {
  fetchTimeMs: number
  ocrTimeMs: number
  classificationTimeMs: number
  mergeTimeMs: number
  totalTimeMs: number
  wordCount: number
  imageCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ImageClassification {
  imageIndex: number
  imageType: 'front' | 'back' | 'neck' | 'strip' | 'other'
  confidence: number
}

export interface ExtractionResult {
  fields: ExtractedField[]
  imageClassifications: ImageClassification[]
  detectedBeverageType: string | null
  processingTimeMs: number
  modelUsed: string
  rawResponse: unknown
  metrics: PipelineMetrics
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Full extraction pipeline: OCR all images -> classify fields -> merge bounding boxes.
 *
 * 1. Runs Tesseract.js WASM OCR on all images
 * 2. Builds a combined word list with global indices
 * 3. Rule-based field classification (regex, dictionary, fuzzy search)
 * 4. Maps classified fields back to bounding boxes from OCR results
 */
export async function extractLabelFields(
  imageUrls: string[],
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch image bytes from private blob storage
  const fetchStart = performance.now()
  const imageBuffers = await Promise.all(imageUrls.map(fetchImageBytes))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  return extractLabelFieldsFromBuffers(
    imageBuffers,
    beverageType,
    startTime,
    fetchTimeMs,
    applicationData,
  )
}

/**
 * Same pipeline as extractLabelFields, but accepts pre-fetched image buffers.
 * Useful for scripts that already have the image bytes in memory.
 */
export async function extractLabelFieldsFromBuffers(
  imageBuffers: Buffer[],
  beverageType: BeverageType,
  startTime = performance.now(),
  fetchTimeMs = 0,
  applicationData?: Record<string, string>,
): Promise<ExtractionResult> {
  // Stage 1: OCR all images in parallel
  const ocrStart = performance.now()
  const ocrResults = await extractTextMultiImage(imageBuffers)
  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  // Build combined word list for classification
  const combinedWords = buildCombinedWordList(ocrResults)
  const wordListForPrompt = combinedWords.map((w) => ({
    index: w.globalIndex,
    text: w.text,
  }))

  // Combine full text from all images
  const combinedFullText = ocrResults
    .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
    .join('\n\n')

  // Stage 2: Rule-based classification (no LLM)
  const classificationStart = performance.now()
  const { result: classification, usage } = await classifyFields(
    combinedFullText,
    beverageType,
    wordListForPrompt,
    applicationData,
    imageBuffers,
  )
  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  // Stage 3: Map classified fields to bounding boxes
  const mergeStart = performance.now()
  const fields = mergeFieldsWithBoundingBoxes(
    classification,
    combinedWords,
    ocrResults,
  )
  const mergeTimeMs = Math.round(performance.now() - mergeStart)
  const totalTimeMs = Math.round(performance.now() - startTime)

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs,
    totalTimeMs,
    wordCount: combinedWords.length,
    imageCount: imageBuffers.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }

  return {
    fields,
    imageClassifications: classification.imageClassifications ?? [],
    detectedBeverageType: classification.detectedBeverageType ?? null,
    processingTimeMs: totalTimeMs,
    modelUsed:
      usage.totalTokens > 0 ? 'tesseract+gpt-4.1-mini' : 'tesseract+rules',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Submission pipeline (tesseract+rules, text-only, with reasoning + bounding boxes)
// ---------------------------------------------------------------------------

/**
 * Submission-optimized pipeline: OCR → rule-based classification → local bbox matching.
 *
 * Targets <5s total to meet Sarah Chen's "about 5 seconds" usability threshold.
 * The comparison engine (not AI confidence) determines match/mismatch outcomes.
 *
 * - Stage 1: OCR via Tesseract.js WASM (~1-2s)
 * - Stage 2: Rule-based classification (~5ms)
 * - Stage 3: Local text matching for bounding boxes (~1ms)
 */
export async function extractLabelFieldsForSubmission(
  imageUrls: string[],
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
  preloadedBuffers?: Buffer[],
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Use pre-fetched buffers if available (overlapped with DB writes), otherwise fetch now
  const fetchStart = performance.now()
  const imageBuffers =
    preloadedBuffers ?? (await Promise.all(imageUrls.map(fetchImageBytes)))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  // Stage 1: OCR all images in parallel
  const ocrStart = performance.now()
  const ocrResults = await extractTextMultiImage(imageBuffers)
  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  // Combine full text from all images
  const combinedFullText = ocrResults
    .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
    .join('\n\n')

  // Stage 2: Rule-based classification (no LLM)
  const classificationStart = performance.now()
  const { result: classification, usage } = await classifyFieldsForSubmission(
    combinedFullText,
    beverageType,
    applicationData,
  )
  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  // Stage 3: Local text matching — map extracted values to OCR bounding boxes
  const mergeStart = performance.now()
  const rawFields: ExtractedField[] = classification.fields.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: f.confidence,
    reasoning: f.reasoning,
    boundingBox: null,
    imageIndex: 0,
  }))
  const fields = matchFieldsToBoundingBoxes(rawFields, ocrResults)
  const mergeTimeMs = Math.round(performance.now() - mergeStart)

  const totalTimeMs = Math.round(performance.now() - startTime)
  const wordCount = ocrResults.reduce((sum, r) => sum + r.words.length, 0)

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs,
    totalTimeMs,
    wordCount,
    imageCount: imageBuffers.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }

  // Classify images from OCR text (no LLM call needed)
  const imageClassifications = classifyImagesFromOcr(ocrResults)

  return {
    fields,
    imageClassifications,
    detectedBeverageType: beverageType,
    processingTimeMs: totalTimeMs,
    modelUsed: 'tesseract+rules',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Applicant-side extraction (no beverage type, no application data)
// ---------------------------------------------------------------------------

/**
 * Extraction-only pipeline for applicant pre-fill.
 * Does NOT require beverage type — keyword detection infers it from the label.
 * Returns extracted fields, image classifications, and detected beverage type.
 */
export async function extractLabelFieldsForApplicant(
  imageUrls: string[],
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch image bytes from private blob storage
  const fetchStart = performance.now()
  const imageBuffers = await Promise.all(imageUrls.map(fetchImageBytes))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  // Stage 1: OCR all images in parallel
  const ocrStart = performance.now()
  const ocrResults = await extractTextMultiImage(imageBuffers)
  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  // Build combined word list for classification
  const combinedWords = buildCombinedWordList(ocrResults)
  const wordListForPrompt = combinedWords.map((w) => ({
    index: w.globalIndex,
    text: w.text,
  }))

  // Combine full text from all images
  const combinedFullText = ocrResults
    .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
    .join('\n\n')

  // Stage 2: Rule-based extraction (no beverage type)
  const classificationStart = performance.now()
  const { result: classification, usage } = await extractFieldsOnly(
    combinedFullText,
    wordListForPrompt,
  )
  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  // Stage 3: Map classified fields to bounding boxes
  const mergeStart = performance.now()
  const fields = mergeFieldsWithBoundingBoxes(
    classification,
    combinedWords,
    ocrResults,
  )
  const mergeTimeMs = Math.round(performance.now() - mergeStart)
  const totalTimeMs = Math.round(performance.now() - startTime)

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs,
    totalTimeMs,
    wordCount: combinedWords.length,
    imageCount: imageBuffers.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }

  return {
    fields,
    imageClassifications: classification.imageClassifications ?? [],
    detectedBeverageType: classification.detectedBeverageType ?? null,
    processingTimeMs: totalTimeMs,
    modelUsed:
      usage.totalTokens > 0 ? 'tesseract+gpt-4.1-mini' : 'tesseract+rules',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Applicant-side extraction WITH beverage type (faster — fewer fields)
// ---------------------------------------------------------------------------

/**
 * Beverage-type-aware extraction for applicant pre-fill.
 * Uses type-specific field list for more focused extraction.
 */
export async function extractLabelFieldsForApplicantWithType(
  imageUrls: string[],
  beverageType: BeverageType,
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch image bytes from private blob storage
  const fetchStart = performance.now()
  const imageBuffers = await Promise.all(imageUrls.map(fetchImageBytes))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  // Stage 1: OCR all images in parallel
  const ocrStart = performance.now()
  const ocrResults = await extractTextMultiImage(imageBuffers)
  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  // Combine full text from all images (no word list needed — no bounding boxes)
  const combinedFullText = ocrResults
    .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
    .join('\n\n')

  // Stage 2: Rule-based classification
  const classificationStart = performance.now()
  const { result: classification, usage } = await classifyFieldsForExtraction(
    combinedFullText,
    beverageType,
  )
  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  // Stage 3: Local text matching — map extracted values to OCR bounding boxes
  const mergeStart = performance.now()
  const rawFields: ExtractedField[] = classification.fields.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: f.confidence,
    reasoning: f.reasoning,
    boundingBox: null,
    imageIndex: 0,
  }))
  const fields = matchFieldsToBoundingBoxes(rawFields, ocrResults)
  const mergeTimeMs = Math.round(performance.now() - mergeStart)

  const totalTimeMs = Math.round(performance.now() - startTime)
  const wordCount = ocrResults.reduce((sum, r) => sum + r.words.length, 0)

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs,
    totalTimeMs,
    wordCount,
    imageCount: imageBuffers.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }

  // Classify images from OCR text (no LLM call needed)
  const imageClassifications = classifyImagesFromOcr(ocrResults)

  return {
    fields,
    imageClassifications,
    detectedBeverageType: beverageType,
    processingTimeMs: totalTimeMs,
    modelUsed:
      usage.totalTokens > 0 ? 'tesseract+gpt-4.1-mini' : 'tesseract+rules',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Auto-detect pipeline: keyword detection → type-specific extraction
// ---------------------------------------------------------------------------

/**
 * Pipeline 5: Auto-detect beverage type from OCR text, then run type-specific
 * extraction. Falls back to Pipeline 4 (full extraction) if type can't be
 * determined from keywords.
 *
 * 1. Fetch images + OCR (shared with all pipelines)
 * 2. Keyword-based type detection (~0ms)
 * 3a. If type detected → rule-based type-specific extraction (~5ms)
 * 3b. If ambiguous → rule-based full extraction (~5ms)
 * 4. Local bounding box matching (~1ms)
 */
export async function extractLabelFieldsWithAutoDetect(
  imageUrls: string[],
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch image bytes from private blob storage
  const fetchStart = performance.now()
  const imageBuffers = await Promise.all(imageUrls.map(fetchImageBytes))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  // Stage 1: OCR all images in parallel
  const ocrStart = performance.now()
  const ocrResults = await extractTextMultiImage(imageBuffers)
  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  // Combine full text from all images
  const combinedFullText = ocrResults
    .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
    .join('\n\n')

  // Stage 2: Keyword-based beverage type detection (~0ms)
  const detectedType = detectBeverageTypeFromText(combinedFullText)

  // Stage 3: Classification — type-specific (fast) or generic (fallback)
  const classificationStart = performance.now()
  let classificationResult: Awaited<
    ReturnType<typeof classifyFieldsForExtraction>
  >
  let modelUsed: string
  let detectedBeverageType: string | null

  if (detectedType) {
    // Happy path: use type-specific extraction (LLM or rule-based)
    classificationResult = await classifyFieldsForExtraction(
      combinedFullText,
      detectedType,
    )
    detectedBeverageType = detectedType
  } else {
    // Fallback: use full extraction across all field types
    const combinedWords = buildCombinedWordList(ocrResults)
    const wordListForPrompt = combinedWords.map((w) => ({
      index: w.globalIndex,
      text: w.text,
    }))
    classificationResult = await extractFieldsOnly(
      combinedFullText,
      wordListForPrompt,
    )
    detectedBeverageType =
      classificationResult.result.detectedBeverageType ?? null
  }
  modelUsed =
    classificationResult.usage.totalTokens > 0
      ? 'tesseract+gpt-4.1-mini'
      : 'tesseract+rules'

  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  // Stage 4: Local text matching — map extracted values to OCR bounding boxes
  const mergeStart = performance.now()
  const rawFields: ExtractedField[] = classificationResult.result.fields.map(
    (f) => ({
      fieldName: f.fieldName,
      value: f.value,
      confidence: f.confidence,
      reasoning: f.reasoning,
      boundingBox: null,
      imageIndex: 0,
    }),
  )
  const fields = matchFieldsToBoundingBoxes(rawFields, ocrResults)
  const mergeTimeMs = Math.round(performance.now() - mergeStart)

  const totalTimeMs = Math.round(performance.now() - startTime)
  const wordCount = ocrResults.reduce((sum, r) => sum + r.words.length, 0)
  const { usage } = classificationResult

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs,
    totalTimeMs,
    wordCount,
    imageCount: imageBuffers.length,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  }

  return {
    fields,
    imageClassifications:
      classificationResult.result.imageClassifications ?? [],
    detectedBeverageType,
    processingTimeMs: totalTimeMs,
    modelUsed,
    rawResponse: {
      classification: classificationResult.result,
      usage,
      metrics,
    },
    metrics,
  }
}
