import {
  extractTextMultiImage,
  type OcrResult,
  type OcrWord,
} from '@/lib/ai/ocr'
import {
  classifyFields,
  classifyFieldsForExtraction,
  classifyFieldsForSubmission,
  extractFieldsOnly,
} from '@/lib/ai/classify-fields'
import { fetchImageBytes } from '@/lib/storage/blob'

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
// Indexed word — tracks which image each word came from
// ---------------------------------------------------------------------------

interface IndexedWord {
  globalIndex: number
  imageIndex: number
  localWordIndex: number
  text: string
  word: OcrWord
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes a normalized bounding box (0-1 range) from a set of OCR words
 * and the source image dimensions.
 */
function computeNormalizedBoundingBox(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
): {
  x: number
  y: number
  width: number
  height: number
  angle: number
} | null {
  if (words.length === 0 || imageWidth === 0 || imageHeight === 0) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const word of words) {
    for (const vertex of word.boundingPoly.vertices) {
      if (vertex.x < minX) minX = vertex.x
      if (vertex.y < minY) minY = vertex.y
      if (vertex.x > maxX) maxX = vertex.x
      if (vertex.y > maxY) maxY = vertex.y
    }
  }

  if (
    !isFinite(minX) ||
    !isFinite(minY) ||
    !isFinite(maxX) ||
    !isFinite(maxY)
  ) {
    return null
  }

  return {
    x: minX / imageWidth,
    y: minY / imageHeight,
    width: (maxX - minX) / imageWidth,
    height: (maxY - minY) / imageHeight,
    angle: computeTextAngle(words),
  }
}

/**
 * Computes the dominant text reading angle (in degrees) from a set of OCR words.
 * Uses the baseline direction (vertex[0] → vertex[1]) of each word to determine
 * how the text is oriented. Returns 0 for horizontal, 90 for top-to-bottom,
 * -90 for bottom-to-top, 180 for upside-down. Rounds to the nearest 90°.
 */
function computeTextAngle(words: OcrWord[]): number {
  if (words.length === 0) return 0

  // Accumulate the baseline direction vectors from all words
  let sumDx = 0
  let sumDy = 0

  for (const word of words) {
    const v = word.boundingPoly.vertices
    if (v.length < 2) continue
    // v[0] is top-left in reading direction, v[1] is top-right
    // The vector v[0]→v[1] points in the reading direction
    sumDx += v[1].x - v[0].x
    sumDy += v[1].y - v[0].y
  }

  if (sumDx === 0 && sumDy === 0) return 0

  // atan2 gives the angle in radians; convert to degrees
  const angleRad = Math.atan2(sumDy, sumDx)
  const angleDeg = (angleRad * 180) / Math.PI

  // Round to the nearest 90°
  const snapped = Math.round(angleDeg / 90) * 90

  // Normalize to [-180, 180]
  if (snapped > 180) return snapped - 360
  if (snapped <= -180) return snapped + 360
  return snapped
}

/**
 * Builds a combined word list across all images, preserving the mapping
 * from global index back to image + local word.
 */
function buildCombinedWordList(ocrResults: OcrResult[]): IndexedWord[] {
  const combined: IndexedWord[] = []
  let globalIndex = 0

  for (let imageIndex = 0; imageIndex < ocrResults.length; imageIndex++) {
    const result = ocrResults[imageIndex]
    for (let localIndex = 0; localIndex < result.words.length; localIndex++) {
      combined.push({
        globalIndex,
        imageIndex,
        localWordIndex: localIndex,
        text: result.words[localIndex].text,
        word: result.words[localIndex],
      })
      globalIndex++
    }
  }

  return combined
}

// ---------------------------------------------------------------------------
// Local text matching: map extracted values → OCR bounding boxes (no LLM)
// ---------------------------------------------------------------------------

/** Normalize text for fuzzy matching (lowercase, strip punctuation, collapse whitespace) */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?'"()\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Finds the best consecutive sequence of OCR words that matches a field value.
 * Pure CPU — no LLM call. Runs in <1ms for typical label word counts (~150 words).
 */
function findMatchingWords(value: string, words: IndexedWord[]): IndexedWord[] {
  const target = norm(value)
  if (!target) return []

  let bestMatch: IndexedWord[] = []
  let bestScore = 0

  for (let i = 0; i < words.length; i++) {
    let accumulated = ''
    const candidates: IndexedWord[] = []

    for (let j = i; j < words.length && j < i + 60; j++) {
      if (candidates.length > 0) accumulated += ' '
      accumulated += words[j].text
      candidates.push(words[j])

      const accNorm = norm(accumulated)

      // Perfect match
      if (accNorm === target) return [...candidates]

      // Score: how much of the target is covered
      if (target.includes(accNorm)) {
        const score = accNorm.length / target.length
        if (score > bestScore) {
          bestScore = score
          bestMatch = [...candidates]
        }
      } else if (accNorm.includes(target)) {
        // Accumulated text contains the target — good enough
        if (target.length > bestScore * target.length) {
          bestScore = 1
          bestMatch = [...candidates]
        }
        break
      }

      // Stop extending if we've gone well past the target length
      if (accNorm.length > target.length * 1.5 + 20) break
    }
  }

  // Only return if we matched at least 60% of the target
  return bestScore >= 0.6 ? bestMatch : []
}

/**
 * Maps extracted field values back to OCR bounding boxes using local text matching.
 * Takes fields with null boundingBox and fills them in by finding matching OCR words.
 * Adds ~1ms of CPU time — no LLM call needed.
 */
function matchFieldsToBoundingBoxes(
  fields: ExtractedField[],
  ocrResults: OcrResult[],
): ExtractedField[] {
  const combinedWords = buildCombinedWordList(ocrResults)

  return fields.map((field) => {
    if (!field.value) return field

    const matched = findMatchingWords(field.value, combinedWords)
    if (matched.length === 0) return field

    // Find primary image (most words)
    const imageCounts = new Map<number, number>()
    for (const w of matched) {
      imageCounts.set(w.imageIndex, (imageCounts.get(w.imageIndex) ?? 0) + 1)
    }
    let imageIndex = 0
    let maxCount = 0
    for (const [idx, count] of imageCounts) {
      if (count > maxCount) {
        maxCount = count
        imageIndex = idx
      }
    }

    // Compute bounding box from matched words on the primary image
    const wordsOnImage = matched.filter((w) => w.imageIndex === imageIndex)
    const ocrResult = ocrResults[imageIndex]
    const boundingBox = ocrResult
      ? computeNormalizedBoundingBox(
          wordsOnImage.map((w) => w.word),
          ocrResult.imageWidth,
          ocrResult.imageHeight,
        )
      : null

    return { ...field, boundingBox, imageIndex }
  })
}

// ---------------------------------------------------------------------------
// Shared merge: classification result → ExtractedField[] with bounding boxes
// ---------------------------------------------------------------------------

function mergeFieldsWithBoundingBoxes(
  classification: {
    fields: Array<{
      fieldName: string
      value: string | null
      confidence: number
      wordIndices: number[]
      reasoning: string | null
    }>
  },
  combinedWords: IndexedWord[],
  ocrResults: OcrResult[],
): ExtractedField[] {
  return classification.fields.map((classified) => {
    const referencedWords = classified.wordIndices
      .map((idx) => combinedWords.find((w) => w.globalIndex === idx))
      .filter((w): w is IndexedWord => w !== undefined)

    let imageIndex = 0
    if (referencedWords.length > 0) {
      const imageCounts = new Map<number, number>()
      for (const word of referencedWords) {
        imageCounts.set(
          word.imageIndex,
          (imageCounts.get(word.imageIndex) ?? 0) + 1,
        )
      }
      let maxCount = 0
      for (const [idx, count] of imageCounts) {
        if (count > maxCount) {
          maxCount = count
          imageIndex = idx
        }
      }
    }

    const wordsOnPrimaryImage = referencedWords.filter(
      (w) => w.imageIndex === imageIndex,
    )
    const ocrWordsForBbox = wordsOnPrimaryImage.map((w) => w.word)
    const ocrResult = ocrResults[imageIndex]

    const boundingBox = ocrResult
      ? computeNormalizedBoundingBox(
          ocrWordsForBbox,
          ocrResult.imageWidth,
          ocrResult.imageHeight,
        )
      : null

    return {
      fieldName: classified.fieldName,
      value: classified.value,
      confidence: classified.confidence,
      reasoning: classified.reasoning,
      boundingBox,
      imageIndex,
    }
  })
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Full extraction pipeline: OCR all images -> classify fields -> merge bounding boxes.
 *
 * 1. Runs Google Cloud Vision OCR on all images in parallel
 * 2. Builds a combined word list with global indices
 * 3. Sends the combined text to GPT-5 Mini for field classification
 * 4. Maps classified fields back to bounding boxes from OCR results
 */
export async function extractLabelFields(
  imageUrls: string[],
  beverageType: string,
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
  beverageType: string,
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

  // Log metrics to server console for debugging
  console.log(
    `[AI Pipeline] ${beverageType} | OCR: ${ocrTimeMs}ms | Classification: ${classificationTimeMs}ms | Total: ${totalTimeMs}ms | Words: ${combinedWords.length} | Tokens: ${usage.inputTokens}in/${usage.outputTokens}out`,
  )

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
// Submission pipeline (gpt-5-mini, text-only, with reasoning + bounding boxes)
// ---------------------------------------------------------------------------

/**
 * Submission-optimized pipeline: OCR → text-only gpt-5-mini → local bbox matching.
 *
 * Keeps gpt-5-mini reasoning quality (specialists rely on confidence levels)
 * while dropping multimodal image overhead (~30-40s savings → ~15-20s total).
 *
 * - Stage 1: OCR via Google Cloud Vision (~600ms)
 * - Stage 2: Text-only classification via gpt-5-mini (~10-15s)
 * - Stage 3: Local text matching for bounding boxes (~1ms)
 */
export async function extractLabelFieldsForSubmission(
  imageUrls: string[],
  beverageType: string,
  applicationData?: Record<string, string>,
): Promise<ExtractionResult> {
  const startTime = performance.now()

  // Fetch image bytes from private blob storage (needed for OCR, not sent to LLM)
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

  // Stage 2: Text-only classification via gpt-5-mini (no images sent)
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

  console.log(
    `[AI Pipeline] Submission (${beverageType}) | OCR: ${ocrTimeMs}ms | Classification: ${classificationTimeMs}ms | BBox match: ${mergeTimeMs}ms | Total: ${totalTimeMs}ms | Words: ${wordCount} | Tokens: ${usage.inputTokens}in/${usage.outputTokens}out`,
  )

  return {
    fields,
    imageClassifications: [],
    detectedBeverageType: beverageType,
    processingTimeMs: totalTimeMs,
    modelUsed: 'gpt-5-mini',
    rawResponse: { classification, usage, metrics },
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

  console.log(
    `[AI Pipeline] Extraction (applicant) | OCR: ${ocrTimeMs}ms | Classification: ${classificationTimeMs}ms | Total: ${totalTimeMs}ms | Words: ${combinedWords.length} | Tokens: ${usage.inputTokens}in/${usage.outputTokens}out`,
  )

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
  beverageType: string,
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

  console.log(
    `[AI Pipeline] Fast extraction (${beverageType}) | OCR: ${ocrTimeMs}ms | Classification: ${classificationTimeMs}ms | BBox match: ${mergeTimeMs}ms | Total: ${totalTimeMs}ms | Words: ${wordCount} | Tokens: ${usage.inputTokens}in/${usage.outputTokens}out`,
  )

  return {
    fields,
    imageClassifications: [],
    detectedBeverageType: beverageType,
    processingTimeMs: totalTimeMs,
    modelUsed: 'gpt-4.1',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}
