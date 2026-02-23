import {
  extractTextMultiImage,
  type OcrResult,
  type OcrWord,
} from '@/lib/ai/ocr'
import { classifyFields } from '@/lib/ai/classify-fields'
import { fetchImageBytes } from '@/lib/storage/blob'

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

export interface ExtractionResult {
  fields: ExtractedField[]
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
): { x: number; y: number; width: number; height: number } | null {
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
  }
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
  const fields: ExtractedField[] = classification.fields.map((classified) => {
    // Collect the OCR words referenced by this field
    const referencedWords = classified.wordIndices
      .map((idx) => combinedWords.find((w) => w.globalIndex === idx))
      .filter((w): w is IndexedWord => w !== undefined)

    // Determine which image this field primarily belongs to
    // (use the most common image index among referenced words)
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

    // Compute bounding box from the referenced words on the primary image
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
    processingTimeMs: totalTimeMs,
    modelUsed: 'gpt-5-mini',
    rawResponse: { classification, usage, metrics },
    metrics,
  }
}
