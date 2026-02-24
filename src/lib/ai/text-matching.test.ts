import { vi } from 'vitest'
import type { OcrWord, OcrResult } from '@/lib/ai/ocr'
import type { ExtractedField } from '@/lib/ai/extract-label'
import type { IndexedWord } from '@/lib/ai/text-matching'

// Mock computeNormalizedBoundingBox to isolate text-matching logic.
// Return a deterministic bounding box so we can verify it was called.
vi.mock('@/lib/ai/bounding-box-math', () => ({
  computeNormalizedBoundingBox: vi.fn(
    (words: OcrWord[], imageWidth: number, imageHeight: number) => {
      if (words.length === 0 || imageWidth === 0 || imageHeight === 0)
        return null
      return { x: 0.1, y: 0.2, width: 0.3, height: 0.4, angle: 0 }
    },
  ),
}))

import {
  findMatchingWords,
  matchFieldsToBoundingBoxes,
  buildCombinedWordList,
  norm,
} from '@/lib/ai/text-matching'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Creates a minimal OcrWord with placeholder bounding box and confidence. */
function makeOcrWord(text: string): OcrWord {
  return {
    text,
    boundingPoly: {
      vertices: [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 30 },
        { x: 10, y: 30 },
      ],
    },
    confidence: 0.99,
  }
}

/** Creates an IndexedWord array from a list of strings. All words belong to imageIndex 0. */
function makeIndexedWords(
  texts: string[],
  imageIndex = 0,
  startGlobalIndex = 0,
): IndexedWord[] {
  return texts.map((text, i) => ({
    globalIndex: startGlobalIndex + i,
    imageIndex,
    localWordIndex: i,
    text,
    word: makeOcrWord(text),
  }))
}

/** Creates a minimal OcrResult from a list of word strings. */
function makeOcrResult(texts: string[]): OcrResult {
  return {
    words: texts.map(makeOcrWord),
    fullText: texts.join(' '),
    imageWidth: 1000,
    imageHeight: 800,
  }
}

/** Creates a minimal ExtractedField with no bounding box. */
function makeField(fieldName: string, value: string | null): ExtractedField {
  return {
    fieldName,
    value,
    confidence: 0.95,
    reasoning: null,
    boundingBox: null,
    imageIndex: 0,
  }
}

// ---------------------------------------------------------------------------
// norm (normalization helper)
// ---------------------------------------------------------------------------

describe('norm', () => {
  it('lowercases text', () => {
    expect(norm('HELLO WORLD')).toBe('hello world')
  })

  it('strips periods except decimal points', () => {
    expect(norm('Dr. Smith')).toBe('dr smith')
    expect(norm('12.5%')).toBe('12.5%')
  })

  it('replaces punctuation with space', () => {
    expect(norm('ALC/VOL')).toBe('alc vol')
  })

  it('collapses whitespace', () => {
    expect(norm('  hello   world  ')).toBe('hello world')
  })

  it('returns empty for empty string', () => {
    expect(norm('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — basic matching
// ---------------------------------------------------------------------------

describe('findMatchingWords — basic matching', () => {
  it('finds consecutive OCR words that match a field value', () => {
    const words = makeIndexedWords([
      'BULLEIT',
      'BOURBON',
      'WHISKEY',
      '750',
      'mL',
    ])

    const result = findMatchingWords('Bulleit Bourbon', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('BULLEIT')
    expect(result[1].text).toBe('BOURBON')
  })

  it('matches a single OCR word for a single-word value', () => {
    const words = makeIndexedWords(['KENTUCKY', 'BOURBON', 'FRONTIER'])

    const result = findMatchingWords('Frontier', words)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('FRONTIER')
  })

  it('matches words anywhere in the OCR word list', () => {
    const words = makeIndexedWords([
      'PRODUCT',
      'OF',
      'USA',
      'BOTTLED',
      'BY',
      'OLD',
      'TOM',
      'DISTILLERY',
    ])

    const result = findMatchingWords('Old Tom Distillery', words)

    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('OLD')
    expect(result[1].text).toBe('TOM')
    expect(result[2].text).toBe('DISTILLERY')
  })

  it('is case-insensitive', () => {
    const words = makeIndexedWords(['government', 'warning'])

    const result = findMatchingWords('GOVERNMENT WARNING', words)

    expect(result).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — space-collapsed matching
// ---------------------------------------------------------------------------

describe('findMatchingWords — space-collapsed matching', () => {
  it('matches "750mL" OCR token against extracted "750 mL"', () => {
    const words = makeIndexedWords(['NET', 'CONTENTS', '750mL'])

    const result = findMatchingWords('750 mL', words)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('750mL')
  })

  it('matches "375ml" OCR token against extracted "375 ml"', () => {
    const words = makeIndexedWords(['BOURBON', '375ml', 'ALC'])

    const result = findMatchingWords('375 ml', words)

    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('375ml')
  })

  it('matches multi-word OCR when collapsed matches collapsed target', () => {
    // OCR produces "ALC" + "VOL" but the extracted value is "ALC/VOL"
    // norm("ALC/VOL") = "alc vol" (/ replaced with space)
    // norm("ALC") + " " + norm("VOL") = "alc vol"
    // This should match via the normal consecutive path.
    const words = makeIndexedWords(['45%', 'ALC', 'VOL'])

    const result = findMatchingWords('ALC/VOL', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('ALC')
    expect(result[1].text).toBe('VOL')
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — numeric smart-join
// ---------------------------------------------------------------------------

describe('findMatchingWords — numeric smart-join', () => {
  it('joins "12." + "5%" to match "12.5%"', () => {
    const words = makeIndexedWords(['ALC', '12.', '5%', 'VOL'])

    const result = findMatchingWords('12.5%', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('12.')
    expect(result[1].text).toBe('5%')
  })

  it('joins "12" + "." + "5%" to match "12.5%"', () => {
    const words = makeIndexedWords(['ALC', '12', '.', '5%', 'VOL'])

    const result = findMatchingWords('12.5%', words)

    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('12')
    expect(result[1].text).toBe('.')
    expect(result[2].text).toBe('5%')
  })

  it('joins "12.5" + "%" to match "12.5%"', () => {
    const words = makeIndexedWords(['ALC', '12.5', '%', 'VOL'])

    const result = findMatchingWords('12.5%', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('12.5')
    expect(result[1].text).toBe('%')
  })

  it('handles "45" + "%" to match "45%"', () => {
    const words = makeIndexedWords(['ALCOHOL', '45', '%', 'BY'])

    const result = findMatchingWords('45%', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('45')
    expect(result[1].text).toBe('%')
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — empty/null handling
// ---------------------------------------------------------------------------

describe('findMatchingWords — empty/null handling', () => {
  it('returns empty array for empty string value', () => {
    const words = makeIndexedWords(['HELLO', 'WORLD'])

    const result = findMatchingWords('', words)

    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only value', () => {
    const words = makeIndexedWords(['HELLO', 'WORLD'])

    const result = findMatchingWords('   ', words)

    expect(result).toEqual([])
  })

  it('returns empty array when word list is empty', () => {
    const result = findMatchingWords('hello', [])

    expect(result).toEqual([])
  })

  it('returns empty array for punctuation-only value', () => {
    const words = makeIndexedWords(['HELLO', 'WORLD'])

    // norm("...") strips all periods (not between digits) -> ""
    const result = findMatchingWords('...', words)

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — partial matching (60% threshold)
// ---------------------------------------------------------------------------

describe('findMatchingWords — partial matching', () => {
  it('returns match when at least 60% of target is covered', () => {
    // Target: "old tom distillery" (18 chars). If OCR has "Old Tom" (7 chars),
    // that is only ~39%, below 60%. Use a case where coverage exceeds 60%.
    // "old tom distiller" is 17 chars out of 18 = 94%.
    const words = makeIndexedWords(['OLD', 'TOM', 'DISTILLER', 'SINCE', '1820'])

    // "Old Tom Distillery" = norm("old tom distillery")
    // OCR has "OLD TOM DISTILLER" = norm("old tom distiller")
    // "old tom distiller" (17 chars) is contained in "old tom distillery" (18 chars)
    // Score = 17/18 = 0.944 >= 0.6
    const result = findMatchingWords('Old Tom Distillery', words)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].text).toBe('OLD')
  })

  it('returns empty when less than 60% of target is covered', () => {
    // Target: "Kentucky Straight Bourbon Whiskey" (norm = "kentucky straight bourbon whiskey", 33 chars)
    // OCR only has "KENTUCKY" (8 chars) -> 8/33 = 0.24, below 0.6
    const words = makeIndexedWords([
      'KENTUCKY',
      'STYLE',
      'SAUCE',
      'BBQ',
      'RECIPE',
    ])

    const result = findMatchingWords('Kentucky Straight Bourbon Whiskey', words)

    expect(result).toEqual([])
  })

  it('returns the best partial match when multiple candidates exist', () => {
    // Two occurrences of "OLD TOM" but the second is followed by "DIST"
    // which extends coverage further.
    const words = makeIndexedWords([
      'OLD',
      'TOM',
      'BRAND',
      'OLD',
      'TOM',
      'DIST',
    ])

    const result = findMatchingWords('Old Tom Distillery', words)

    // The second "OLD TOM DIST" has better coverage than the first "OLD TOM"
    expect(result.length).toBeGreaterThan(0)
    // The best match should start at the second "OLD" (index 3)
    expect(result[0].globalIndex).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// findMatchingWords — skips punctuation-only starting tokens
// ---------------------------------------------------------------------------

describe('findMatchingWords — punctuation tokens', () => {
  it('skips punctuation-only tokens that normalize to empty', () => {
    // "." and "," normalize to empty. The function should skip them as start points
    // but still find the match starting at "BOURBON".
    const words = makeIndexedWords(['.', ',', 'BOURBON', 'WHISKEY'])

    const result = findMatchingWords('Bourbon Whiskey', words)

    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('BOURBON')
    expect(result[1].text).toBe('WHISKEY')
  })
})

// ---------------------------------------------------------------------------
// buildCombinedWordList
// ---------------------------------------------------------------------------

describe('buildCombinedWordList', () => {
  it('assigns sequential global indices across multiple images', () => {
    const ocrResults: OcrResult[] = [
      makeOcrResult(['HELLO', 'WORLD']),
      makeOcrResult(['FOO', 'BAR', 'BAZ']),
    ]

    const combined = buildCombinedWordList(ocrResults)

    expect(combined).toHaveLength(5)
    expect(combined[0].globalIndex).toBe(0)
    expect(combined[0].imageIndex).toBe(0)
    expect(combined[0].text).toBe('HELLO')
    expect(combined[2].globalIndex).toBe(2)
    expect(combined[2].imageIndex).toBe(1)
    expect(combined[2].localWordIndex).toBe(0)
    expect(combined[2].text).toBe('FOO')
    expect(combined[4].globalIndex).toBe(4)
    expect(combined[4].text).toBe('BAZ')
  })

  it('returns empty array for empty input', () => {
    expect(buildCombinedWordList([])).toEqual([])
  })

  it('handles single image', () => {
    const combined = buildCombinedWordList([makeOcrResult(['ONE'])])

    expect(combined).toHaveLength(1)
    expect(combined[0].globalIndex).toBe(0)
    expect(combined[0].imageIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// matchFieldsToBoundingBoxes — basic behavior
// ---------------------------------------------------------------------------

describe('matchFieldsToBoundingBoxes — basic behavior', () => {
  it('fills in boundingBox for a field with matching OCR words', () => {
    const fields: ExtractedField[] = [
      makeField('brand_name', 'Bulleit Bourbon'),
    ]
    const ocrResults: OcrResult[] = [
      makeOcrResult(['BULLEIT', 'BOURBON', 'WHISKEY']),
    ]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result).toHaveLength(1)
    expect(result[0].boundingBox).not.toBeNull()
    expect(result[0].imageIndex).toBe(0)
  })

  it('returns field unchanged when value is null', () => {
    const fields: ExtractedField[] = [makeField('fanciful_name', null)]
    const ocrResults: OcrResult[] = [makeOcrResult(['HELLO'])]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).toBeNull()
  })

  it('returns field unchanged when no OCR words match', () => {
    const fields: ExtractedField[] = [
      makeField('brand_name', 'Completely Nonexistent Brand XYZ'),
    ]
    const ocrResults: OcrResult[] = [
      makeOcrResult(['BOURBON', 'WHISKEY', '750mL']),
    ]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).toBeNull()
  })

  it('processes multiple fields independently', () => {
    const fields: ExtractedField[] = [
      makeField('brand_name', 'Bulleit'),
      makeField('net_contents', '750 mL'),
    ]
    const ocrResults: OcrResult[] = [
      makeOcrResult(['BULLEIT', 'BOURBON', '750mL']),
    ]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).not.toBeNull()
    expect(result[1].boundingBox).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// matchFieldsToBoundingBoxes — prefix fallback for long values
// ---------------------------------------------------------------------------

describe('matchFieldsToBoundingBoxes — prefix fallback for long values', () => {
  const healthWarning =
    'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

  it('falls back to prefix matching when full health warning text fails', () => {
    // Simulate OCR that has the beginning of the health warning but with
    // a slight OCR error mid-way that prevents full-text matching.
    // The prefix "GOVERNMENT WARNING (1) According to the Surgeon General women should"
    // should match even if the rest of the OCR text diverges.
    const ocrWords = [
      'BULLEIT',
      'BOURBON',
      'GOVERNMENT',
      'WARNING',
      '(1)',
      'According',
      'to',
      'the',
      'Surgeon',
      'General',
      'women',
      'should',
      'not',
      'drlnk', // OCR error: "drlnk" instead of "drink"
      'alcohollc', // OCR error
      'beverages',
    ]

    const fields: ExtractedField[] = [
      makeField('health_warning', healthWarning),
    ]
    const ocrResults: OcrResult[] = [makeOcrResult(ocrWords)]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    // Should still get a bounding box from the prefix fallback
    expect(result[0].boundingBox).not.toBeNull()
  })

  it('does not use prefix fallback for short values (<= 80 chars)', () => {
    const shortValue = 'Bulleit Bourbon Kentucky Straight Whiskey'

    // OCR with no match at all
    const fields: ExtractedField[] = [makeField('brand_name', shortValue)]
    const ocrResults: OcrResult[] = [
      makeOcrResult(['COMPLETELY', 'UNRELATED', 'TEXT', 'HERE']),
    ]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    // Short value has no fallback, so it stays null
    expect(result[0].boundingBox).toBeNull()
  })

  it('uses prefix of first ~8 words for long values', () => {
    // A long value (>80 chars) where full matching fails but the
    // first 8 words are present in OCR.
    const longValue =
      'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy.'

    // OCR has first 8 words exactly, then diverges completely
    const ocrWords = [
      'LABEL',
      'INFO',
      'GOVERNMENT',
      'WARNING',
      '(1)',
      'According',
      'to',
      'the',
      'Surgeon',
      'General',
      'SOMETHING',
      'COMPLETELY',
      'DIFFERENT',
    ]

    const fields: ExtractedField[] = [makeField('health_warning', longValue)]
    const ocrResults: OcrResult[] = [makeOcrResult(ocrWords)]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).not.toBeNull()
  })

  it('returns null when even the prefix does not match', () => {
    const longValue =
      'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy.'

    const ocrWords = [
      'COMPLETELY',
      'UNRELATED',
      'OCR',
      'TEXT',
      'ABOUT',
      'SOMETHING',
      'ELSE',
      'ENTIRELY',
    ]

    const fields: ExtractedField[] = [makeField('health_warning', longValue)]
    const ocrResults: OcrResult[] = [makeOcrResult(ocrWords)]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// matchFieldsToBoundingBoxes — multi-image support
// ---------------------------------------------------------------------------

describe('matchFieldsToBoundingBoxes — multi-image support', () => {
  it('assigns correct imageIndex when match is on second image', () => {
    const fields: ExtractedField[] = [makeField('brand_name', 'Bulleit')]
    const ocrResults: OcrResult[] = [
      makeOcrResult(['BOURBON', 'WHISKEY']),
      makeOcrResult(['BULLEIT', 'FRONTIER']),
    ]

    const result = matchFieldsToBoundingBoxes(fields, ocrResults)

    expect(result[0].boundingBox).not.toBeNull()
    expect(result[0].imageIndex).toBe(1)
  })
})
