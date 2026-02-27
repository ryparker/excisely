import { fuzzyMatch, normalizeWhitespace } from '@/lib/ai/compare-fields'
import { HEALTH_WARNING_PREFIX } from '@/config/health-warning'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum bigram similarity to consider a fuzzy text match */
export const MIN_SIMILARITY = 0.6

/** Above this threshold, OCR noise is the only difference — return expected */
export const HIGH_CONFIDENCE = 0.75

/**
 * Landmark phrases that uniquely identify standardized label text.
 * If the expected value starts with one of these prefixes and the prefix
 * is detected in the OCR text, the full standardized text must be present.
 *
 * This handles OCR engines (especially Tesseract) that garble long,
 * small-print regulatory text beyond what fuzzy matching can recover.
 */
const LANDMARK_PREFIXES = [
  HEALTH_WARNING_PREFIX.toLowerCase(), // "government warning:"
]

// ---------------------------------------------------------------------------
// Text search — find expected values in OCR output
// ---------------------------------------------------------------------------

/**
 * Searches OCR text for a substring matching the expected value.
 * Returns the best matching text from the OCR output, or null if not found.
 *
 * Strategy:
 * 1. Exact case-insensitive substring match
 * 2. Punctuation-normalized substring (handles OCR dropping dots, hyphens)
 * 3. Landmark prefix detection (e.g., GOVERNMENT WARNING with OCR typos)
 * 4. Word-level sliding window with bigram similarity (Dice coefficient)
 * 5. Scattered word matching (all significant words found individually)
 *
 * When a fuzzy match is strong enough (≥ 0.75), the text IS on the label and
 * any differences are OCR noise — we return the expected value so the
 * comparison engine sees a clean match.
 */
export function findInOcrText(
  ocrText: string,
  expectedValue: string,
): string | null {
  const normalizedOcr = normalizeWhitespace(ocrText)
  const normalizedExpected = normalizeWhitespace(expectedValue)

  if (!normalizedOcr || !normalizedExpected) return null

  const lowerOcr = normalizedOcr.toLowerCase()
  const lowerExpected = normalizedExpected.toLowerCase()

  // --- Stage 1: Exact case-insensitive substring match ---
  const exactIdx = lowerOcr.indexOf(lowerExpected)
  if (exactIdx !== -1) {
    return normalizedOcr.slice(exactIdx, exactIdx + normalizedExpected.length)
  }

  // --- Stage 2: Punctuation-normalized substring ---
  // OCR commonly drops or swaps periods, commas, hyphens
  const stripPunc = (s: string) => s.replace(/[.,'\-]/g, '')
  if (stripPunc(lowerOcr).includes(stripPunc(lowerExpected))) {
    return expectedValue
  }

  // --- Stage 3: Landmark prefix detection ---
  // For standardized regulatory text (e.g., GOVERNMENT WARNING), OCR often
  // garbles the body AND the prefix itself (e.g., "GOVERMENT WARNING",
  // "GOVERIMENT WARNING"). Use fuzzy matching on consecutive word pairs
  // to detect the landmark even with OCR typos.
  //
  // IMPORTANT: Finding the prefix alone is NOT sufficient — the body text
  // must also be meaningfully present. OCR of small-print warnings often
  // preserves the bold prefix but garbles the body beyond recognition.
  // We require key phrases from the body to fuzzy-match in the OCR text.
  for (const prefix of LANDMARK_PREFIXES) {
    if (lowerExpected.startsWith(prefix)) {
      const prefixWords = prefix.replace(/[.:,]/g, '').split(/\s+/)
      const ocrWordsRaw = lowerOcr.replace(/[.:,]/g, '').split(/\s+/)

      let prefixFound = false

      // Slide a window of prefix-length words across OCR text
      for (let i = 0; i <= ocrWordsRaw.length - prefixWords.length; i++) {
        const candidate = ocrWordsRaw.slice(i, i + prefixWords.length).join(' ')
        const target = prefixWords.join(' ')
        const { similarity } = fuzzyMatch(candidate, target)
        if (similarity >= HIGH_CONFIDENCE) {
          prefixFound = true
          break
        }
      }

      if (prefixFound) {
        // Verify body text is actually legible — check key phrases that
        // must appear in the health warning (27 CFR Part 16).
        const bodyPhrases = [
          'surgeon general',
          'pregnancy',
          'birth defects',
          'drive a car',
          'operate machinery',
          'health problems',
        ]
        const ocrLower = lowerOcr.replace(/[.:,]/g, '')
        let phrasesFound = 0
        for (const phrase of bodyPhrases) {
          // Check exact substring first
          if (ocrLower.includes(phrase)) {
            phrasesFound++
            continue
          }
          // Check fuzzy match for OCR typos (e.g., "surgean" vs "surgeon")
          const phraseWords = phrase.split(/\s+/)
          const ocrW = ocrLower.split(/\s+/)
          let allWordsFound = true
          for (const pw of phraseWords) {
            const found = ocrW.some((ow) => {
              if (Math.abs(ow.length - pw.length) > 2) return false
              const { similarity: s } = fuzzyMatch(ow, pw)
              return s >= HIGH_CONFIDENCE
            })
            if (!found) {
              allWordsFound = false
              break
            }
          }
          if (allWordsFound) phrasesFound++
        }

        // Require at least 4 of 6 key phrases to confirm body is legible
        if (phrasesFound >= 4) {
          return expectedValue
        }
        // Prefix found but body garbled — fall through to other stages
      }
    }
  }

  // --- Stage 4: Word-level sliding window with fuzzy matching ---
  const ocrWords = normalizedOcr.split(/\s+/)
  const expectedWordCount = normalizedExpected.split(/\s+/).length

  let bestScore = 0
  let bestMatch: string | null = null

  const minWords = Math.max(1, expectedWordCount - 2)
  const maxWords = Math.min(ocrWords.length, expectedWordCount + 3)

  for (let ws = minWords; ws <= maxWords; ws++) {
    for (let i = 0; i <= ocrWords.length - ws; i++) {
      const candidate = ocrWords.slice(i, i + ws).join(' ')
      const { similarity } = fuzzyMatch(candidate, normalizedExpected)
      if (similarity > bestScore) {
        bestScore = similarity
        bestMatch = candidate
      }
    }
  }

  // High-confidence fuzzy match — text IS on the label, difference is OCR noise
  if (bestScore >= HIGH_CONFIDENCE) return expectedValue

  // --- Stage 5: Scattered word matching ---
  // OCR of decorative/embossed labels often puts each word on its own line
  // with garbage between them. If every significant word (3+ chars) of the
  // expected value can be fuzzy-matched to some word in the OCR text,
  // the expected text IS on the label — just not in a contiguous block.
  // This runs BEFORE accepting a low-confidence sliding window match because
  // scattered words ("KNOB ... CREEK") give a better result than a partial
  // window match ("CREEK" alone at 0.6 similarity).
  const expectedWords = normalizedExpected
    .split(/\s+/)
    .filter((w) => w.length >= 3)
  if (expectedWords.length >= 2) {
    const ocrWordsLower = lowerOcr.split(/\s+/)
    let matchedCount = 0
    for (const ew of expectedWords) {
      const ewLower = ew.toLowerCase()
      // Check exact word match first (case-insensitive)
      if (ocrWordsLower.some((ow) => ow === ewLower)) {
        matchedCount++
        continue
      }
      // Check fuzzy match for OCR typos (e.g., "GOVERMENT" vs "GOVERNMENT")
      if (
        ocrWordsLower.some((ow) => {
          if (Math.abs(ow.length - ewLower.length) > 3) return false
          const { similarity } = fuzzyMatch(ow, ewLower)
          return similarity >= HIGH_CONFIDENCE
        })
      ) {
        matchedCount++
      }
    }
    if (matchedCount === expectedWords.length) {
      return expectedValue
    }
  }

  // Accept medium-confidence sliding window match if scattered words didn't hit
  if (bestScore >= MIN_SIMILARITY) return bestMatch

  return null
}
