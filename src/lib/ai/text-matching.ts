import type { OcrResult, OcrWord } from '@/lib/ai/ocr'
import { computeNormalizedBoundingBox } from '@/lib/ai/bounding-box-math'
import type { ExtractedField } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// Indexed word -- tracks which image each word came from
// ---------------------------------------------------------------------------

export interface IndexedWord {
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
 * Builds a combined word list across all images, preserving the mapping
 * from global index back to image + local word.
 */
export function buildCombinedWordList(ocrResults: OcrResult[]): IndexedWord[] {
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
// Local text matching: map extracted values to OCR bounding boxes (no LLM)
// ---------------------------------------------------------------------------

/** Normalize text for fuzzy matching (lowercase, strip punctuation, collapse whitespace).
 *  Preserves decimal points between digits (e.g. "12.5%" stays "12.5%", not "125%")
 *  so numeric fields like alcohol content match correctly when OCR splits tokens.
 *  Replaces "/" with space so "ALC/VOL" matches OCR tokens "ALC" + "/" + "VOL". */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)/g, '') // strip periods except decimal points
    .replace(/[,;:!?'"()\-\/]/g, ' ') // replace punctuation + "/" with space
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Finds the best consecutive sequence of OCR words that matches a field value.
 * Pure CPU -- no LLM call. Runs in <1ms for typical label word counts (~150 words).
 *
 * Smart-joins adjacent tokens that form split numbers: when one word ends with
 * a digit or period and the next starts with a digit or period, they are joined
 * without a space. This handles OCR splitting "12.5%" into "12." + "5%".
 */
export function findMatchingWords(
  value: string,
  words: IndexedWord[],
): IndexedWord[] {
  const target = norm(value)
  if (!target) return []

  let bestMatch: IndexedWord[] = []
  let bestScore = 0

  for (let i = 0; i < words.length; i++) {
    // Skip starting from punctuation-only tokens (e.g. ".", ",", ":")
    // that normalize to empty. These would bloat the bounding box with
    // stray coordinates from a different line when norm() strips them.
    if (!norm(words[i].text)) continue

    let accumulated = ''
    const candidates: IndexedWord[] = []

    for (let j = i; j < words.length && j < i + 60; j++) {
      if (candidates.length > 0) {
        // Smart-join: skip space when adjacent tokens form part of a number.
        // OCR often splits "12.5%" into "12." + "5%", "12" + "." + "5%",
        // "12.5" + "%", or even "12" + "." + "5" + "%" (four tokens).
        // Check the END of the accumulated text (not just the raw previous word)
        // because prior joins may have already merged numeric fragments.
        // Pattern: accumulated ends with a digit (optionally followed by a period)
        // and the next word starts with a digit, period, or percent sign.
        const currText = words[j].text
        const shouldJoin =
          /\d\.?$/.test(accumulated) && /^[\d.%]/.test(currText)
        if (!shouldJoin) accumulated += ' '
      }
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
        // Accumulated text contains the target -- good enough
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
 * Adds ~1ms of CPU time -- no LLM call needed.
 */
export function matchFieldsToBoundingBoxes(
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

    // Compute bounding box from matched words on the primary image.
    // Filter out punctuation-only tokens (e.g. "/", "(", ")") that normalize
    // to empty -- their OCR coordinates can be far from the actual text on
    // curved surfaces, inflating the bounding box.
    const wordsOnImage = matched.filter(
      (w) => w.imageIndex === imageIndex && norm(w.text),
    )
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
// Shared merge: classification result to ExtractedField[] with bounding boxes
// ---------------------------------------------------------------------------

export function mergeFieldsWithBoundingBoxes(
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
      (w) => w.imageIndex === imageIndex && norm(w.text),
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
