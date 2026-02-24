import type { OcrResult } from '@/lib/ai/ocr'
import type { ImageClassification } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// OCR-text-based image classification (front / back / other)
// ---------------------------------------------------------------------------

/** Keywords that indicate a FRONT label (brand-facing, consumer-visible) */
export const FRONT_LABEL_KEYWORDS = [
  'reserve',
  'estate',
  'vintage',
  'aged',
  'barrel',
  'single malt',
  'small batch',
  'craft',
  'limited edition',
  'special release',
]

/** Keywords that indicate a BACK label (regulatory, fine print) */
export const BACK_LABEL_KEYWORDS = [
  'government warning',
  'according to the surgeon general',
  'women should not drink',
  'contains sulfites',
  'name and address',
  'produced and bottled by',
  'produced & bottled by',
  'bottled by',
  'distilled by',
  'imported by',
  'vinted by',
  'cellared by',
  'net contents',
  'alc.',
  'alc ',
  '% by vol',
  'by volume',
]

/**
 * Classify images as front/back based on OCR text content.
 * Pure heuristic -- no LLM call. Works with text-only pipelines.
 *
 * Strategy: The front label has the brand name prominently and fewer
 * regulatory keywords. The back label has government warnings,
 * producer info, and alcohol content details. When both appear on
 * the same image (common for single-label products), it's classified
 * as "front" since it's the primary label.
 */
export function classifyImagesFromOcr(
  ocrResults: OcrResult[],
): ImageClassification[] {
  if (ocrResults.length <= 1) {
    // Single image -- always "front"
    return ocrResults.length === 1
      ? [{ imageIndex: 0, imageType: 'front', confidence: 90 }]
      : []
  }

  // Score each image
  const scores = ocrResults.map((result, index) => {
    const text = result.fullText.toLowerCase()
    let frontScore = 0
    let backScore = 0

    for (const kw of FRONT_LABEL_KEYWORDS) {
      if (text.includes(kw)) frontScore++
    }
    for (const kw of BACK_LABEL_KEYWORDS) {
      if (text.includes(kw)) backScore++
    }

    // Longer text with more words tends to be the back label (more fine print)
    const wordCount = result.words.length

    return { index, frontScore, backScore, wordCount }
  })

  // Determine which image is front: higher front-to-back ratio, or fewer words
  // (front labels are typically simpler/shorter)
  const classifications: ImageClassification[] = []

  // Find the image most likely to be the front
  let bestFrontIdx = 0
  let bestFrontSignal = -Infinity

  for (const s of scores) {
    // Signal: front keywords minus back keywords, tie-break by fewer words
    const signal = s.frontScore - s.backScore - s.wordCount / 100
    if (signal > bestFrontSignal) {
      bestFrontSignal = signal
      bestFrontIdx = s.index
    }
  }

  // If no clear signal from keywords, use word count: fewer words = front
  const allZeroKeywords = scores.every(
    (s) => s.frontScore === 0 && s.backScore === 0,
  )
  if (allZeroKeywords) {
    bestFrontIdx = scores.reduce(
      (minIdx, s, i) => (s.wordCount < scores[minIdx].wordCount ? i : minIdx),
      0,
    )
  }

  for (let i = 0; i < ocrResults.length; i++) {
    if (i === bestFrontIdx) {
      classifications.push({
        imageIndex: i,
        imageType: 'front',
        confidence: 80,
      })
    } else {
      // Check if this looks like a back label or just "other"
      const s = scores[i]
      const isBack = s.backScore >= 2
      classifications.push({
        imageIndex: i,
        imageType: isBack ? 'back' : 'other',
        confidence: isBack ? 80 : 60,
      })
    }
  }

  return classifications
}
