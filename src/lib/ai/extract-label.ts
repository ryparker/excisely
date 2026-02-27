import { createWorker, OEM, PSM } from 'tesseract.js'
import sharp from 'sharp'

import { extractTextMultiImage } from '@/lib/ai/ocr'
import {
  classifyFields,
  classifyFieldsForExtraction,
  classifyFieldsForSubmission,
  extractFieldsOnly,
} from '@/lib/ai/classify-fields'
import { compareField } from '@/lib/ai/compare-fields'
import { fetchImageBytes } from '@/lib/storage/blob'
import { findInOcrText } from '@/lib/ai/text-search'
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

export const PIPELINE_TIMEOUT_MS = 60_000

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
 * 1. Runs Google Cloud Vision OCR on all images in parallel
 * 2. Builds a combined word list with global indices
 * 3. Sends the combined text + images to GPT-5 Mini for field classification
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

  // Stage 2: Classification via GPT-5 Mini (multimodal — text + images)
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
    modelUsed: 'gpt-5-mini',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Submission pipeline (gpt-4.1-nano, text-only, compact prompt + bounding boxes)
// ---------------------------------------------------------------------------

/**
 * Submission-optimized pipeline: OCR → text-only gpt-4.1-nano → local bbox matching.
 *
 * Targets <5s total to meet Sarah Chen's "about 5 seconds" usability threshold.
 * The comparison engine (not AI confidence) determines match/mismatch outcomes.
 *
 * - Stage 1: OCR via Google Cloud Vision (~600ms)
 * - Stage 2: Text-only classification via gpt-4.1-nano (~2-4s)
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

  // Stage 2: Text-only classification via gpt-4.1-nano (no images sent)
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
    modelUsed: 'gpt-4.1-nano',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Local submission pipeline (Tesseract.js OCR, no cloud calls)
// ---------------------------------------------------------------------------

/**
 * Local-only submission pipeline: Tesseract OCR → text search → comparison.
 *
 * Zero cloud API calls — runs Tesseract.js natively in Node.js.
 * No bounding boxes, no LLM confidence — uses text-search similarity instead.
 * Same `ExtractionResult` interface so downstream validation is unchanged.
 */
export async function extractLabelFieldsLocal(
  imageUrls: string[],
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
  preloadedBuffers?: Buffer[],
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch images (or use preloaded)
  const fetchStart = performance.now()
  const rawBuffers =
    preloadedBuffers ?? (await Promise.all(imageUrls.map(fetchImageBytes)))
  const fetchTimeMs = Math.round(performance.now() - fetchStart)

  // Stage 1: Tesseract OCR with parallel multi-pass preprocessing.
  // Label images often have decorative fonts, gold embossing, dark backgrounds,
  // or small print that a single OCR pass can't capture. We run 3 preprocessing
  // variants per image and ALL passes in parallel (one worker per variant).
  //
  // PSM modes: SPARSE_TEXT (11) works for scattered decorative text on front
  // labels. SINGLE_BLOCK (6) is better for dense structured text on back labels
  // (health warning, name & address). We mix modes across variants for coverage.
  const ocrStart = performance.now()
  const TARGET_WIDTH = 2048

  // Get metadata for all images in parallel
  const metas = await Promise.all(
    rawBuffers.map((buf) => sharp(buf).metadata()),
  )

  // Build preprocessing variants for all images (3 per image)
  type VariantTask = {
    imageIdx: number
    buffer: Promise<Buffer>
    psm: PSM
  }
  const variantTasks: VariantTask[] = []

  for (let i = 0; i < rawBuffers.length; i++) {
    const buf = rawBuffers[i]
    const needsUpscale = (metas[i].width ?? 0) < 1024
    const resizeOpt = needsUpscale
      ? { width: TARGET_WIDTH, fit: 'inside' as const }
      : undefined

    variantTasks.push(
      // Pass 1: upscale + sharpen — SPARSE_TEXT for scattered decorative text
      {
        imageIdx: i,
        buffer: sharp(buf).resize(resizeOpt).sharpen().png().toBuffer(),
        psm: PSM.SPARSE_TEXT,
      },
      // Pass 2: high contrast — SINGLE_BLOCK for dense back-label text
      {
        imageIdx: i,
        buffer: sharp(buf)
          .resize(resizeOpt)
          .greyscale()
          .linear(1.5, -50)
          .sharpen()
          .png()
          .toBuffer(),
        psm: PSM.SINGLE_BLOCK,
      },
      // Pass 3: red channel inverted — SPARSE_TEXT for gold/light text on dark
      {
        imageIdx: i,
        buffer: sharp(buf)
          .resize(resizeOpt)
          .extractChannel(0)
          .negate()
          .linear(2.0, -100)
          .sharpen({ sigma: 2 })
          .png()
          .toBuffer(),
        psm: PSM.SPARSE_TEXT,
      },
    )
  }

  // Resolve all preprocessing in parallel
  const resolvedBuffers = await Promise.all(variantTasks.map((v) => v.buffer))

  // Run all OCR passes in parallel — one Tesseract worker per variant
  const ocrResults = await Promise.all(
    resolvedBuffers.map(async (vBuf, i) => {
      const w = await createWorker('eng', OEM.LSTM_ONLY)
      await w.setParameters({
        tessedit_pageseg_mode: variantTasks[i].psm,
      })
      const { data } = await w.recognize(vBuf)
      await w.terminate()
      return { imageIdx: variantTasks[i].imageIdx, text: data.text }
    }),
  )

  // Group OCR results by image and combine unique lines
  const linesByImage = new Map<number, { seen: Set<string>; lines: string[] }>()

  for (const { imageIdx, text } of ocrResults) {
    if (!text.trim()) continue
    if (!linesByImage.has(imageIdx)) {
      linesByImage.set(imageIdx, { seen: new Set(), lines: [] })
    }
    const { seen, lines } = linesByImage.get(imageIdx)!
    for (const line of text.split('\n')) {
      const normalized = line.trim().toLowerCase()
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized)
        lines.push(line.trim())
      }
    }
  }

  const ocrTexts = rawBuffers.map((_, i) => {
    const entry = linesByImage.get(i)
    return entry ? entry.lines.join('\n') : ''
  })

  const ocrTimeMs = Math.round(performance.now() - ocrStart)

  const combinedOcrText = ocrTexts
    .map((t, i) => `--- Image ${i + 1} ---\n${t}`)
    .join('\n\n')

  // Stage 2: Text search — find expected values in OCR output
  const classificationStart = performance.now()
  const fields: ExtractedField[] = []

  if (applicationData) {
    for (const [fieldName, expectedValue] of Object.entries(applicationData)) {
      const extractedValue = findInOcrText(combinedOcrText, expectedValue)

      // Use comparison engine confidence for the extraction confidence
      const comparison = compareField(fieldName, expectedValue, extractedValue)

      // Determine which image the field was found on by searching each
      // image's OCR text individually (the combined text found it, but we
      // need to attribute it to a specific image).
      let imageIndex = 0
      if (extractedValue && ocrTexts.length > 1) {
        for (let i = 0; i < ocrTexts.length; i++) {
          if (ocrTexts[i] && findInOcrText(ocrTexts[i], expectedValue)) {
            imageIndex = i
            break
          }
        }
      }

      fields.push({
        fieldName,
        value: extractedValue,
        confidence: comparison.confidence,
        reasoning: comparison.reasoning,
        boundingBox: null,
        imageIndex,
      })
    }
  }
  const classificationTimeMs = Math.round(
    performance.now() - classificationStart,
  )

  const totalTimeMs = Math.round(performance.now() - startTime)

  const metrics: PipelineMetrics = {
    fetchTimeMs,
    ocrTimeMs,
    classificationTimeMs,
    mergeTimeMs: 0,
    totalTimeMs,
    wordCount: combinedOcrText.split(/\s+/).length,
    imageCount: rawBuffers.length,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  }

  return {
    fields,
    imageClassifications: [],
    detectedBeverageType: beverageType,
    processingTimeMs: totalTimeMs,
    modelUsed: 'tesseract-local',
    rawResponse: { ocrText: combinedOcrText, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Applicant-side extraction (no beverage type, no application data)
// ---------------------------------------------------------------------------

/**
 * Extraction-only pipeline for applicant pre-fill.
 * Does NOT require beverage type — the model detects it from the label.
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

  // Stage 2: Extraction via GPT-5 Mini (no beverage type)
  // Skip sending image buffers — OCR text is sufficient for applicant pre-fill.
  // Visual verification happens during specialist review, where accuracy > speed.
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
    modelUsed: 'gpt-5-mini',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}

// ---------------------------------------------------------------------------
// Applicant-side extraction WITH beverage type (faster — fewer fields)
// ---------------------------------------------------------------------------

/**
 * Ultra-fast beverage-type-aware extraction for applicant pre-fill.
 * Optimized for speed: text-only prompt, minimal schema, no bounding boxes.
 * Bounding boxes aren't needed — the applicant reviews and corrects values.
 * The specialist review later does the thorough visual verification.
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

  // Stage 2: Text-only classification (minimal schema, no images)
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
    modelUsed: 'gpt-4.1-nano',
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
 * 2. Keyword-based type detection (~0ms, free)
 * 3a. If type detected → classifyFieldsForExtraction (Pipeline 3, gpt-4.1-mini, ~2-4s)
 * 3b. If ambiguous → extractFieldsOnly (Pipeline 4, gpt-5-mini, ~10-20s)
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
    // Happy path: use fast type-specific extraction (gpt-4.1-mini, ~2-4s)
    classificationResult = await classifyFieldsForExtraction(
      combinedFullText,
      detectedType,
    )
    modelUsed = 'gpt-4.1-mini'
    detectedBeverageType = detectedType
  } else {
    // Fallback: use full extraction with word indices (gpt-5-mini, ~10-20s)
    const combinedWords = buildCombinedWordList(ocrResults)
    const wordListForPrompt = combinedWords.map((w) => ({
      index: w.globalIndex,
      text: w.text,
    }))
    classificationResult = await extractFieldsOnly(
      combinedFullText,
      wordListForPrompt,
    )
    modelUsed = 'gpt-5-mini'
    detectedBeverageType =
      classificationResult.result.detectedBeverageType ?? null
  }

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
