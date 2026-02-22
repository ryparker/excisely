// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchType = 'exact' | 'fuzzy' | 'normalized' | 'contains' | 'enum'

export interface ComparisonResult {
  status: 'match' | 'mismatch' | 'not_found'
  confidence: number
  reasoning: string
}

// ---------------------------------------------------------------------------
// Match-type strategy per field name
// ---------------------------------------------------------------------------

const FIELD_MATCH_STRATEGY: Record<string, MatchType> = {
  health_warning: 'exact',
  brand_name: 'fuzzy',
  fanciful_name: 'fuzzy',
  alcohol_content: 'normalized',
  net_contents: 'normalized',
  class_type: 'fuzzy',
  name_and_address: 'fuzzy',
  qualifying_phrase: 'enum',
  country_of_origin: 'contains',
  grape_varietal: 'fuzzy',
  appellation_of_origin: 'fuzzy',
  vintage_year: 'exact',
  sulfite_declaration: 'fuzzy',
  age_statement: 'normalized',
  state_of_distillation: 'fuzzy',
}

// ---------------------------------------------------------------------------
// Known qualifying phrases (case-insensitive matching)
// ---------------------------------------------------------------------------

const QUALIFYING_PHRASES = [
  'bottled by',
  'packed by',
  'distilled by',
  'blended by',
  'produced by',
  'prepared by',
  'manufactured by',
  'made by',
  'brewed by',
  'imported by',
  'cellared and bottled by',
  'vinted and bottled by',
  'estate bottled',
]

// ---------------------------------------------------------------------------
// Helper: normalize whitespace
// ---------------------------------------------------------------------------

/**
 * Collapses multiple whitespace characters into single spaces and trims.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Helper: fuzzy match using bigram similarity
// ---------------------------------------------------------------------------

function bigrams(str: string): Set<string> {
  const result = new Set<string>()
  const lower = str.toLowerCase()
  for (let i = 0; i < lower.length - 1; i++) {
    result.add(lower.slice(i, i + 2))
  }
  return result
}

/**
 * Computes a similarity score (0-1) between two strings using bigram overlap
 * (Dice coefficient). Simple, no external library needed.
 */
export function fuzzyMatch(
  a: string,
  b: string,
): { match: boolean; similarity: number } {
  const normA = normalizeWhitespace(a)
  const normB = normalizeWhitespace(b)

  if (normA.toLowerCase() === normB.toLowerCase()) {
    return { match: true, similarity: 1 }
  }

  if (normA.length < 2 || normB.length < 2) {
    // For very short strings, fall back to case-insensitive equality
    const isMatch = normA.toLowerCase() === normB.toLowerCase()
    return { match: isMatch, similarity: isMatch ? 1 : 0 }
  }

  const bigramsA = bigrams(normA)
  const bigramsB = bigrams(normB)

  let intersection = 0
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++
  }

  const similarity = (2 * intersection) / (bigramsA.size + bigramsB.size)

  // Threshold of 0.8 for a fuzzy match
  return { match: similarity >= 0.8, similarity }
}

// ---------------------------------------------------------------------------
// Helper: normalize alcohol content to numeric ABV
// ---------------------------------------------------------------------------

/**
 * Extracts a numeric ABV percentage from various formats:
 * "45% Alc./Vol.", "45% Alc/Vol", "45% ABV", "90 Proof" (→ 45%), "12.5%"
 */
export function normalizeAlcoholContent(value: string): number | null {
  const cleaned = normalizeWhitespace(value)

  // Match proof first: "90 Proof" → 45%
  const proofMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*proof/i)
  if (proofMatch) {
    return parseFloat(proofMatch[1]) / 2
  }

  // Match percentage: "45%", "45% Alc./Vol.", "12.5% ABV"
  const pctMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*%/)
  if (pctMatch) {
    return parseFloat(pctMatch[1])
  }

  return null
}

// ---------------------------------------------------------------------------
// Helper: normalize net contents to milliliters
// ---------------------------------------------------------------------------

const UNIT_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
  centilitre: 10,
  centilitres: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  oz: 29.5735,
  'fl oz': 29.5735,
  'fl. oz': 29.5735,
  'fl. oz.': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
}

/**
 * Parses net contents to milliliters from various formats:
 * "750 mL", "750ml", "75cL", "1.5 L", "25.4 FL OZ", "1 Liter"
 */
export function normalizeNetContents(value: string): number | null {
  const cleaned = normalizeWhitespace(value)

  // Extract numeric value and unit
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(.+)/i)
  if (!match) return null

  const numericValue = parseFloat(match[1])
  const unitStr = match[2].toLowerCase().replace(/\.$/, '').trim()

  const multiplier = UNIT_TO_ML[unitStr]
  if (multiplier !== undefined) {
    return Math.round(numericValue * multiplier * 100) / 100
  }

  // Try partial matching for compound units like "fl oz"
  for (const [unit, ml] of Object.entries(UNIT_TO_ML)) {
    if (unitStr.includes(unit)) {
      return Math.round(numericValue * ml * 100) / 100
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Helper: normalize age statement to years
// ---------------------------------------------------------------------------

function normalizeAgeStatement(value: string): number | null {
  const cleaned = normalizeWhitespace(value)
  const match = cleaned.match(/(\d+)\s*(?:years?|yr)/i)
  if (match) return parseInt(match[1], 10)
  // Also handle "Aged X" pattern
  const agedMatch = cleaned.match(/aged\s+(\d+)/i)
  if (agedMatch) return parseInt(agedMatch[1], 10)
  return null
}

// ---------------------------------------------------------------------------
// Core comparison
// ---------------------------------------------------------------------------

/**
 * Compares an expected field value against an extracted (OCR + AI) value.
 * Uses field-specific comparison strategies for accurate matching.
 */
export function compareField(
  fieldName: string,
  expected: string,
  extracted: string | null,
  matchType?: MatchType,
): ComparisonResult {
  if (!extracted || extracted.trim() === '') {
    return {
      status: 'not_found',
      confidence: 0,
      reasoning: `Field "${fieldName}" was not found on the label.`,
    }
  }

  const strategy = matchType ?? FIELD_MATCH_STRATEGY[fieldName] ?? 'fuzzy'

  switch (strategy) {
    case 'exact':
      return compareExact(fieldName, expected, extracted)
    case 'fuzzy':
      return compareFuzzy(fieldName, expected, extracted)
    case 'normalized':
      return compareNormalized(fieldName, expected, extracted)
    case 'contains':
      return compareContains(fieldName, expected, extracted)
    case 'enum':
      return compareEnum(fieldName, expected, extracted)
    default:
      return compareFuzzy(fieldName, expected, extracted)
  }
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

function compareExact(
  fieldName: string,
  expected: string,
  extracted: string,
): ComparisonResult {
  const normExpected = normalizeWhitespace(expected)
  const normExtracted = normalizeWhitespace(extracted)

  if (normExpected === normExtracted) {
    return {
      status: 'match',
      confidence: 100,
      reasoning: `${fieldName} matches exactly after whitespace normalization.`,
    }
  }

  // For health warning and vintage year, case matters differently
  if (fieldName === 'vintage_year') {
    // Pure numeric comparison
    const expYear = normExpected.replace(/\D/g, '')
    const extYear = normExtracted.replace(/\D/g, '')
    if (expYear === extYear) {
      return {
        status: 'match',
        confidence: 95,
        reasoning: `${fieldName} year values match: ${expYear}.`,
      }
    }
  }

  // For health warning, check case-insensitive as a fallback with lower confidence
  if (fieldName === 'health_warning') {
    if (normExpected.toLowerCase() === normExtracted.toLowerCase()) {
      return {
        status: 'match',
        confidence: 85,
        reasoning: `${fieldName} matches case-insensitively. Check that "GOVERNMENT WARNING" prefix is in all caps on the label.`,
      }
    }

    // Check if it contains the key phrases even with OCR artifacts
    const { similarity } = fuzzyMatch(normExpected, normExtracted)
    if (similarity >= 0.9) {
      return {
        status: 'match',
        confidence: Math.round(similarity * 80),
        reasoning: `${fieldName} is very similar (${Math.round(similarity * 100)}%). Minor OCR discrepancies detected.`,
      }
    }
  }

  return {
    status: 'mismatch',
    confidence: 90,
    reasoning: `${fieldName} does not match. Expected: "${normExpected.slice(0, 100)}..." Found: "${normExtracted.slice(0, 100)}..."`,
  }
}

function compareFuzzy(
  fieldName: string,
  expected: string,
  extracted: string,
): ComparisonResult {
  const { match, similarity } = fuzzyMatch(expected, extracted)

  if (match) {
    return {
      status: 'match',
      confidence: Math.round(similarity * 100),
      reasoning: `${fieldName} matches with ${Math.round(similarity * 100)}% similarity.`,
    }
  }

  // Check if one contains the other (handles partial OCR reads)
  const normExpected = normalizeWhitespace(expected).toLowerCase()
  const normExtracted = normalizeWhitespace(extracted).toLowerCase()

  if (
    normExtracted.includes(normExpected) ||
    normExpected.includes(normExtracted)
  ) {
    const containsSimilarity =
      Math.min(normExpected.length, normExtracted.length) /
      Math.max(normExpected.length, normExtracted.length)
    return {
      status: 'match',
      confidence: Math.round(containsSimilarity * 85),
      reasoning: `${fieldName} partially matches (containment). Similarity: ${Math.round(containsSimilarity * 100)}%.`,
    }
  }

  return {
    status: 'mismatch',
    confidence: Math.round((1 - similarity) * 90),
    reasoning: `${fieldName} does not match. Similarity: ${Math.round(similarity * 100)}%. Expected: "${expected}" Found: "${extracted}"`,
  }
}

function compareNormalized(
  fieldName: string,
  expected: string,
  extracted: string,
): ComparisonResult {
  if (fieldName === 'alcohol_content') {
    const expAbv = normalizeAlcoholContent(expected)
    const extAbv = normalizeAlcoholContent(extracted)

    if (expAbv === null || extAbv === null) {
      // Fall back to fuzzy if we can't parse
      return compareFuzzy(fieldName, expected, extracted)
    }

    // Allow 0.5% tolerance for rounding differences
    if (Math.abs(expAbv - extAbv) <= 0.5) {
      return {
        status: 'match',
        confidence: Math.abs(expAbv - extAbv) === 0 ? 100 : 90,
        reasoning: `Alcohol content matches: expected ${expAbv}%, found ${extAbv}%.`,
      }
    }

    return {
      status: 'mismatch',
      confidence: 95,
      reasoning: `Alcohol content mismatch: expected ${expAbv}%, found ${extAbv}%.`,
    }
  }

  if (fieldName === 'net_contents') {
    const expMl = normalizeNetContents(expected)
    const extMl = normalizeNetContents(extracted)

    if (expMl === null || extMl === null) {
      return compareFuzzy(fieldName, expected, extracted)
    }

    // Allow 1% tolerance for unit conversion rounding
    const tolerance = expMl * 0.01
    if (Math.abs(expMl - extMl) <= tolerance) {
      return {
        status: 'match',
        confidence: Math.abs(expMl - extMl) === 0 ? 100 : 90,
        reasoning: `Net contents matches: expected ${expMl}mL, found ${extMl}mL.`,
      }
    }

    return {
      status: 'mismatch',
      confidence: 95,
      reasoning: `Net contents mismatch: expected ${expMl}mL, found ${extMl}mL.`,
    }
  }

  if (fieldName === 'age_statement') {
    const expAge = normalizeAgeStatement(expected)
    const extAge = normalizeAgeStatement(extracted)

    if (expAge === null || extAge === null) {
      return compareFuzzy(fieldName, expected, extracted)
    }

    if (expAge === extAge) {
      return {
        status: 'match',
        confidence: 100,
        reasoning: `Age statement matches: ${expAge} years.`,
      }
    }

    return {
      status: 'mismatch',
      confidence: 95,
      reasoning: `Age statement mismatch: expected ${expAge} years, found ${extAge} years.`,
    }
  }

  // Default fallback to fuzzy
  return compareFuzzy(fieldName, expected, extracted)
}

function compareContains(
  fieldName: string,
  expected: string,
  extracted: string,
): ComparisonResult {
  const normExpected = normalizeWhitespace(expected).toLowerCase()
  const normExtracted = normalizeWhitespace(extracted).toLowerCase()

  if (
    normExtracted.includes(normExpected) ||
    normExpected.includes(normExtracted)
  ) {
    return {
      status: 'match',
      confidence: 90,
      reasoning: `${fieldName} found within extracted text.`,
    }
  }

  // Try word-level overlap for country names that may appear differently
  const expectedWords = normExpected.split(' ')
  const matchingWords = expectedWords.filter((w) => normExtracted.includes(w))
  const overlapRatio = matchingWords.length / expectedWords.length

  if (overlapRatio >= 0.5) {
    return {
      status: 'match',
      confidence: Math.round(overlapRatio * 80),
      reasoning: `${fieldName} partially matches (${matchingWords.join(', ')} found in extracted text).`,
    }
  }

  return {
    status: 'mismatch',
    confidence: 85,
    reasoning: `${fieldName} not found in extracted text. Expected: "${expected}" Found: "${extracted}"`,
  }
}

function compareEnum(
  fieldName: string,
  expected: string,
  extracted: string,
): ComparisonResult {
  const normExpected = normalizeWhitespace(expected).toLowerCase()
  const normExtracted = normalizeWhitespace(extracted).toLowerCase()

  if (fieldName === 'qualifying_phrase') {
    // Check if both match a known qualifying phrase
    const expectedPhrase = QUALIFYING_PHRASES.find(
      (p) => normExpected.includes(p) || p.includes(normExpected),
    )
    const extractedPhrase = QUALIFYING_PHRASES.find(
      (p) => normExtracted.includes(p) || p.includes(normExtracted),
    )

    if (
      expectedPhrase &&
      extractedPhrase &&
      expectedPhrase === extractedPhrase
    ) {
      return {
        status: 'match',
        confidence: 95,
        reasoning: `Qualifying phrase matches: "${expectedPhrase}".`,
      }
    }

    if (
      expectedPhrase &&
      extractedPhrase &&
      expectedPhrase !== extractedPhrase
    ) {
      return {
        status: 'mismatch',
        confidence: 90,
        reasoning: `Qualifying phrase mismatch: expected "${expectedPhrase}", found "${extractedPhrase}".`,
      }
    }
  }

  // Fall back to fuzzy matching
  return compareFuzzy(fieldName, expected, extracted)
}
