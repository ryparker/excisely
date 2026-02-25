import type { BeverageType } from '@/config/beverage-types'
import { BEVERAGE_TYPES } from '@/config/beverage-types'
import { QUALIFYING_PHRASES } from '@/config/qualifying-phrases'
import { CLASS_TYPE_CODES } from '@/config/class-type-codes'
import { findVarietalInText } from '@/config/grape-varietals'
import { findAppellationInText } from '@/config/appellations'
import { fuzzyMatch, normalizeWhitespace } from '@/lib/ai/compare-fields'
import { FIELD_DESCRIPTIONS } from '@/lib/ai/prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleClassifiedField {
  fieldName: string
  value: string | null
  confidence: number
  wordIndices: number[]
  reasoning: string | null
}

export interface RuleClassificationResult {
  fields: RuleClassifiedField[]
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

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Normalize text for matching: lowercase, collapse whitespace, strip outer punctuation */
function norm(s: string): string {
  return normalizeWhitespace(s).toLowerCase()
}

/** Normalize ampersands to "and" for qualifying phrase matching */
function normalizeAmpersand(s: string): string {
  return s.replace(/&/g, 'and')
}

// ---------------------------------------------------------------------------
// Application-data-driven classification (specialist flow)
// ---------------------------------------------------------------------------

/**
 * When application data is provided, classification becomes a text-search
 * problem: "find WHERE each expected value appears in the OCR text."
 * This is the critical path for the specialist submission pipeline.
 */
function classifyWithApplicationData(
  ocrText: string,
  beverageType: BeverageType | null,
  applicationData: Record<string, string>,
): RuleClassifiedField[] {
  const fields: RuleClassifiedField[] = []
  const normOcr = norm(ocrText)
  const normOcrAmp = norm(normalizeAmpersand(ocrText))

  for (const [fieldName, expectedValue] of Object.entries(applicationData)) {
    if (!expectedValue || expectedValue.trim() === '') {
      fields.push({
        fieldName,
        value: null,
        confidence: 0,
        wordIndices: [],
        reasoning: 'No expected value provided in application data.',
      })
      continue
    }

    const normExpected = norm(expectedValue)

    // Try exact substring match first
    if (normOcr.includes(normExpected)) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: 95,
        wordIndices: [],
        reasoning: `Found exact match in OCR text.`,
      })
      continue
    }

    // Try with ampersand normalization (for qualifying phrases like "Produced & Bottled by")
    const normExpectedAmp = norm(normalizeAmpersand(expectedValue))
    if (normOcrAmp.includes(normExpectedAmp)) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: 93,
        wordIndices: [],
        reasoning: `Found match after normalizing "&" to "and".`,
      })
      continue
    }

    // Try space-collapsed match (for "750mL" vs "750 mL")
    const collapsedOcr = normOcr.replace(/ /g, '')
    const collapsedExpected = normExpected.replace(/ /g, '')
    if (collapsedOcr.includes(collapsedExpected)) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: 90,
        wordIndices: [],
        reasoning: `Found match after collapsing spaces.`,
      })
      continue
    }

    // Try punctuation-stripped match (handles "Vol." vs "Vol", "OZ." vs "OZ")
    const stripPunct = (s: string) => s.replace(/[.,;:!?]/g, '')
    const punctOcr = stripPunct(normOcr)
    const punctExpected = stripPunct(normExpected)
    if (punctOcr.includes(punctExpected)) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: 88,
        wordIndices: [],
        reasoning: 'Found match after stripping punctuation.',
      })
      continue
    }

    // Try punctuation-stripped + space-collapsed
    const punctCollapsedOcr = punctOcr.replace(/ /g, '')
    const punctCollapsedExpected = punctExpected.replace(/ /g, '')
    if (punctCollapsedOcr.includes(punctCollapsedExpected)) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: 85,
        wordIndices: [],
        reasoning: 'Found match after stripping punctuation and collapsing spaces.',
      })
      continue
    }

    // Fuzzy sliding window — find best local match in OCR text
    const result = findBestFuzzyWindow(normOcr, normExpected)
    if (result.similarity >= 0.7) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: Math.round(result.similarity * 100),
        wordIndices: [],
        reasoning: `Fuzzy match with ${Math.round(result.similarity * 100)}% similarity.`,
      })
      continue
    }

    // Try fuzzy window with ampersand normalization
    const resultAmp = findBestFuzzyWindow(normOcrAmp, normExpectedAmp)
    if (resultAmp.similarity >= 0.7) {
      fields.push({
        fieldName,
        value: expectedValue,
        confidence: Math.round(resultAmp.similarity * 100),
        wordIndices: [],
        reasoning: `Fuzzy match (ampersand-normalized) with ${Math.round(resultAmp.similarity * 100)}% similarity.`,
      })
      continue
    }

    // Token overlap — for fragmented OCR where expected words are scattered
    // across the text (e.g., "37.5% Alc. By Vol. (75 Proof)" split across lines).
    // Only activates for fields with >= 3 significant tokens to avoid false positives.
    const stripAllPunct = (s: string) => s.replace(/[.,;:!?()\[\]{}'"]/g, '')
    const expectedTokens = normExpected.split(/\s+/)
    const significantTokens = expectedTokens.filter(
      (t) => stripAllPunct(t).length >= 3,
    )

    if (significantTokens.length >= 3) {
      const ocrNoPunct = stripAllPunct(normOcr)
      let matchedCount = 0

      for (const token of significantTokens) {
        const stripped = stripAllPunct(token)
        if (normOcr.includes(token) || ocrNoPunct.includes(stripped)) {
          matchedCount++
        }
      }

      const matchRatio = matchedCount / significantTokens.length
      if (matchRatio >= 0.75) {
        fields.push({
          fieldName,
          value: expectedValue,
          confidence: Math.round(matchRatio * 85),
          wordIndices: [],
          reasoning: `Token overlap: ${matchedCount}/${significantTokens.length} significant tokens found (${Math.round(matchRatio * 100)}%).`,
        })
        continue
      }
    }

    // Not found
    fields.push({
      fieldName,
      value: null,
      confidence: 0,
      wordIndices: [],
      reasoning: `Expected value not found in OCR text.`,
    })
  }

  // Add any mandatory fields not in applicationData
  if (beverageType) {
    const config = BEVERAGE_TYPES[beverageType]
    const allFields = [...config.mandatoryFields, ...config.optionalFields]
    const coveredFields = new Set(fields.map((f) => f.fieldName))

    for (const fieldName of allFields) {
      if (!coveredFields.has(fieldName)) {
        // Try extraction for fields not in application data
        const extracted = extractSingleField(fieldName, ocrText, beverageType)
        fields.push(extracted)
      }
    }
  }

  return fields
}

/**
 * Find the best fuzzy-matching window in a long OCR text for a target string.
 * Uses a sliding window of roughly the target length.
 */
function findBestFuzzyWindow(
  ocrText: string,
  target: string,
): { similarity: number } {
  const words = ocrText.split(' ')
  const targetWords = target.split(' ')
  const targetLen = targetWords.length

  // Try both exact-length and padded windows:
  // - Exact-length catches OCR typos within words (e.g., "BOTILED" for "BOTTLED")
  // - Padded window catches OCR insertions (e.g., "DISTILLED B & BOTTLED BY")
  const padding = Math.max(2, Math.ceil(targetLen * 0.2))
  const wideWindow = Math.max(targetLen + padding, 5)
  const sizes = new Set([Math.max(targetLen, 3), wideWindow])

  let bestSimilarity = 0

  for (const windowSize of sizes) {
    for (let i = 0; i <= words.length - Math.min(windowSize, words.length); i++) {
      const end = Math.min(i + windowSize, words.length)
      const window = words.slice(i, end).join(' ')
      const { similarity } = fuzzyMatch(window, target)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
      }
    }
  }

  return { similarity: bestSimilarity }
}

// ---------------------------------------------------------------------------
// Extraction-only classification (applicant flow — no application data)
// ---------------------------------------------------------------------------

/**
 * When no application data is provided, use per-field extractors with
 * regex, dictionary matching, and heuristics.
 *
 * Uses two-pass extraction:
 * - Pass 1: Extract all fields EXCEPT brand_name and fanciful_name
 * - Pass 2: Use extracted values as exclusion context to identify brand/fanciful names
 *   by process of elimination (brand names are arbitrary proper nouns — no regex can
 *   identify them, so we strip everything we DO recognize and score what remains)
 */
function classifyWithoutApplicationData(
  ocrText: string,
  beverageType: BeverageType | null,
): RuleClassifiedField[] {
  const fields: RuleClassifiedField[] = []

  // Determine which fields to extract
  let fieldNames: string[]
  if (beverageType) {
    const config = BEVERAGE_TYPES[beverageType]
    fieldNames = [...config.mandatoryFields, ...config.optionalFields]
  } else {
    // Union of all fields
    const allFields = new Set<string>()
    for (const config of Object.values(BEVERAGE_TYPES)) {
      for (const f of config.mandatoryFields) allFields.add(f)
      for (const f of config.optionalFields) allFields.add(f)
    }
    fieldNames = [...allFields]
  }

  // Pass 1: Extract all fields except brand_name and fanciful_name
  for (const fieldName of fieldNames) {
    if (fieldName === 'brand_name' || fieldName === 'fanciful_name') continue
    fields.push(extractSingleField(fieldName, ocrText, beverageType))
  }

  // Pass 2: brand_name and fanciful_name with exclusion context
  const claimedValues = fields.filter((f) => f.value).map((f) => f.value!)

  if (fieldNames.includes('brand_name')) {
    const brand = extractBrandName(ocrText, claimedValues)
    fields.push(brand)
  }

  if (fieldNames.includes('fanciful_name')) {
    const brandValue = fields.find((f) => f.fieldName === 'brand_name')?.value
    fields.push(extractFancifulName(ocrText, claimedValues, brandValue))
  }

  return fields
}

/**
 * Extract a single field from OCR text using field-specific logic.
 */
function extractSingleField(
  fieldName: string,
  ocrText: string,
  beverageType: BeverageType | null,
): RuleClassifiedField {
  const lower = ocrText.toLowerCase()
  const desc = FIELD_DESCRIPTIONS[fieldName] ?? fieldName

  switch (fieldName) {
    // ── Tier 0: exact/prefix match ──────────────────────────────────
    case 'health_warning':
      return extractHealthWarning(ocrText)

    case 'qualifying_phrase':
      return extractQualifyingPhrase(ocrText)

    case 'sulfite_declaration':
      return extractSulfiteDeclaration(lower)

    // ── Tier 1: regex ───────────────────────────────────────────────
    case 'alcohol_content':
      return extractAlcoholContent(ocrText)

    case 'net_contents':
      return extractNetContents(ocrText)

    case 'vintage_year':
      return extractVintageYear(ocrText)

    case 'age_statement':
      return extractAgeStatement(ocrText)

    case 'country_of_origin':
      return extractCountryOfOrigin(ocrText)

    // ── Tier 2: dictionary ──────────────────────────────────────────
    case 'class_type':
      return extractClassType(ocrText, beverageType)

    case 'grape_varietal':
      return extractGrapeVarietal(ocrText)

    case 'appellation_of_origin':
      return extractAppellation(ocrText)

    case 'name_and_address':
      return extractNameAndAddress(ocrText)

    case 'state_of_distillation':
      return extractStateOfDistillation(ocrText)

    // ── Tier 3: heuristic (handled in two-pass extraction) ─────────
    case 'brand_name':
      return makeField(fieldName, null, 0, `${desc} — requires two-pass extraction context.`)

    case 'fanciful_name':
      return makeField(fieldName, null, 0, `${desc} — requires two-pass extraction context.`)

    case 'standards_of_fill':
      return makeField(fieldName, null, 0, 'Computed from net_contents, not extracted from label.')

    default:
      return makeField(fieldName, null, 0, `No extractor for field "${fieldName}".`)
  }
}

// ---------------------------------------------------------------------------
// Per-field extractors
// ---------------------------------------------------------------------------

function extractHealthWarning(ocrText: string): RuleClassifiedField {
  const lower = ocrText.toLowerCase()
  const prefix = 'government warning'

  const idx = lower.indexOf(prefix)
  if (idx === -1) {
    return makeField('health_warning', null, 0, 'GOVERNMENT WARNING prefix not found.')
  }

  // Extract a generous window after the prefix (health warning is ~300 chars)
  const startIdx = idx
  const endIdx = Math.min(ocrText.length, startIdx + 500)
  const extracted = ocrText.slice(startIdx, endIdx).trim()

  // Check if it looks complete (has both section markers)
  const hasSection1 = lower.includes('(1)')
  const hasSection2 = lower.includes('(2)')

  if (hasSection1 && hasSection2) {
    // Find the end of section 2
    const sec2Idx = lower.indexOf('(2)', idx)
    const afterSec2 = ocrText.slice(sec2Idx)
    // End at the next sentence-ending period followed by space/newline or end
    const endMatch = afterSec2.match(/\.\s/)
    const fullEnd = endMatch
      ? sec2Idx + (endMatch.index ?? 0) + 1
      : Math.min(ocrText.length, sec2Idx + 200)
    const fullText = normalizeWhitespace(ocrText.slice(startIdx, fullEnd))

    return makeField('health_warning', fullText, 85, 'Found GOVERNMENT WARNING with both sections.')
  }

  return makeField('health_warning', normalizeWhitespace(extracted), 60, 'Found GOVERNMENT WARNING but may be incomplete.')
}

function extractQualifyingPhrase(ocrText: string): RuleClassifiedField {
  const lower = ocrText.toLowerCase()
  const normalized = normalizeAmpersand(lower)

  // Search longest phrases first (compound before single)
  const sorted = [...QUALIFYING_PHRASES].sort((a, b) => b.length - a.length)

  for (const phrase of sorted) {
    const phraseLower = phrase.toLowerCase()
    if (normalized.includes(phraseLower)) {
      return makeField('qualifying_phrase', phrase, 95, `Found qualifying phrase: "${phrase}".`)
    }
  }

  // Also check for "&" variants directly in the original text
  for (const phrase of sorted) {
    const ampVariant = phrase.toLowerCase().replace(/ and /g, ' & ')
    if (lower.includes(ampVariant)) {
      return makeField('qualifying_phrase', phrase, 93, `Found qualifying phrase (& variant): "${phrase}".`)
    }
  }

  // Fuzzy match (handles OCR typos like "BOTILED" for "BOTTLED", truncation like "DUCED")
  for (const phrase of sorted) {
    const phraseLower = phrase.toLowerCase()
    const result = findBestFuzzyWindow(normalized, phraseLower)
    if (result.similarity >= 0.8) {
      return makeField(
        'qualifying_phrase',
        phrase,
        Math.round(result.similarity * 100),
        `Fuzzy matched qualifying phrase: "${phrase}" (${Math.round(result.similarity * 100)}% similarity).`,
      )
    }
  }

  return makeField('qualifying_phrase', null, 0, 'No known qualifying phrase found.')
}

function extractSulfiteDeclaration(lower: string): RuleClassifiedField {
  if (lower.includes('contains sulfites')) {
    return makeField('sulfite_declaration', 'Contains Sulfites', 95, 'Found "Contains Sulfites" declaration.')
  }
  if (lower.includes('contains sulphites')) {
    return makeField('sulfite_declaration', 'Contains Sulfites', 90, 'Found "Contains Sulphites" (alternate spelling).')
  }
  return makeField('sulfite_declaration', null, 0, 'No sulfite declaration found.')
}

function extractAlcoholContent(ocrText: string): RuleClassifiedField {
  // Match patterns like "45% Alc./Vol.", "12.5% Alc/Vol", "80 Proof", "5.0% ABV"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*alc\.?\s*[/]\s*vol\.?/i,
    /(\d+(?:\.\d+)?)\s*%\s*alcohol\s+by\s+volume/i,
    /(\d+(?:\.\d+)?)\s*%\s*alc\b/i,
    /(\d+(?:\.\d+)?)\s*proof/i,
    /(\d+(?:\.\d+)?)\s*%\s*abv/i,
  ]

  for (const pattern of patterns) {
    const match = ocrText.match(pattern)
    if (match) {
      return makeField('alcohol_content', match[0].trim(), 90, 'Matched alcohol content pattern.')
    }
  }

  return makeField('alcohol_content', null, 0, 'No alcohol content pattern found.')
}

function extractNetContents(ocrText: string): RuleClassifiedField {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*m[lL]\b/,                // "750 mL", "750ml"
    /(\d+(?:\.\d+)?)\s*[cC][lL]\b/,              // "75 cL"
    /(\d+(?:\.\d+)?)\s*[lL](?:\s|$|\.)/,          // "1 L", "1.5 L"
    /(\d+(?:\.\d+)?)\s*(?:FL\.?\s*)?OZ\.?/i,     // "12 FL OZ", "12 oz"
    /(\d+(?:\.\d+)?)\s*(?:liter|litre)s?\b/i,    // "1.5 liters"
  ]

  for (const pattern of patterns) {
    const match = ocrText.match(pattern)
    if (match) {
      return makeField('net_contents', match[0].trim(), 90, 'Matched net contents pattern.')
    }
  }

  return makeField('net_contents', null, 0, 'No net contents pattern found.')
}

function extractVintageYear(ocrText: string): RuleClassifiedField {
  // Match standalone 4-digit years between 1900-2030
  const match = ocrText.match(/\b(19\d{2}|20[0-2]\d|2030)\b/)
  if (match) {
    return makeField('vintage_year', match[1], 80, `Found year: ${match[1]}.`)
  }
  return makeField('vintage_year', null, 0, 'No vintage year found.')
}

function extractAgeStatement(ocrText: string): RuleClassifiedField {
  const patterns = [
    /aged\s+(?:a\s+minimum\s+of\s+)?(\d+)\s*years?/i,
    /(\d+)\s*years?\s*old/i,
    /(\d+)\s*yr\s*old/i,
    /(\d+)\s*-\s*year/i,
  ]

  for (const pattern of patterns) {
    const match = ocrText.match(pattern)
    if (match) {
      return makeField('age_statement', match[0].trim(), 90, 'Matched age statement pattern.')
    }
  }

  return makeField('age_statement', null, 0, 'No age statement found.')
}

function extractCountryOfOrigin(ocrText: string): RuleClassifiedField {
  const patterns: Array<{ regex: RegExp; prefix: string }> = [
    { regex: /product\s+of\s+(\w[\w\s]*\w)/i, prefix: 'Product of' },
    { regex: /imported\s+from\s+(\w[\w\s]*\w)/i, prefix: 'Imported from' },
    { regex: /made\s+in\s+(\w[\w\s]*\w)/i, prefix: 'Made in' },
    { regex: /produced\s+in\s+(\w[\w\s]*\w)/i, prefix: 'Produced in' },
  ]

  for (const { regex, prefix } of patterns) {
    const match = ocrText.match(regex)
    if (match && match[1]) {
      // Use capture group (country name only)
      const raw = match[1].trim()
      // Stop at common English stop words that aren't part of country names
      const stopMatch = raw.match(/\b(?:as|and|by|from|for|is|was|that|which|where)\b/i)
      const country = stopMatch
        ? raw.slice(0, stopMatch.index).trim()
        : raw.split(/\s+/).slice(0, 3).join(' ')
      if (!country) continue
      const fullValue = `${prefix} ${country}`
      return makeField('country_of_origin', fullValue, 85, 'Matched country of origin pattern.')
    }
  }

  return makeField('country_of_origin', null, 0, 'No country of origin found.')
}

function extractClassType(
  ocrText: string,
  beverageType: BeverageType | null,
): RuleClassifiedField {
  const lower = ocrText.toLowerCase()

  // Filter codes by beverage type if known
  const codes = beverageType
    ? CLASS_TYPE_CODES.filter((c) => c.beverageType === beverageType)
    : CLASS_TYPE_CODES

  // Sort by description length descending (match specific before generic)
  const sorted = [...codes].sort(
    (a, b) => b.description.length - a.description.length,
  )

  for (const code of sorted) {
    if (lower.includes(code.description.toLowerCase())) {
      return makeField('class_type', code.description, 85, `Matched class/type code: "${code.description}" (${code.code}).`)
    }
  }

  // Try common class/type descriptions not in the code table
  const commonTypes = [
    'Kentucky Straight Bourbon Whiskey',
    'Straight Bourbon Whiskey',
    'Bourbon Whiskey',
    'Rye Whiskey',
    'Tennessee Whiskey',
    'Single Malt Whisky',
    'Blended Scotch Whisky',
    'London Dry Gin',
    'Table Wine',
    'Red Wine',
    'White Wine',
    'Sparkling Wine',
    'India Pale Ale',
    'Hard Seltzer',
  ]

  for (const ct of commonTypes) {
    if (lower.includes(ct.toLowerCase())) {
      return makeField('class_type', ct, 80, `Found class/type in text: "${ct}".`)
    }
  }

  return makeField('class_type', null, 0, 'No class/type designation found.')
}

function extractGrapeVarietal(ocrText: string): RuleClassifiedField {
  const varietal = findVarietalInText(ocrText)
  if (varietal) {
    return makeField('grape_varietal', varietal, 90, `Found grape varietal: "${varietal}".`)
  }
  return makeField('grape_varietal', null, 0, 'No known grape varietal found.')
}

function extractAppellation(ocrText: string): RuleClassifiedField {
  const appellation = findAppellationInText(ocrText)
  if (appellation) {
    return makeField('appellation_of_origin', appellation, 85, `Found appellation: "${appellation}".`)
  }
  return makeField('appellation_of_origin', null, 0, 'No known appellation found.')
}

function extractNameAndAddress(ocrText: string): RuleClassifiedField {
  // Look for text following a qualifying phrase
  const lower = ocrText.toLowerCase()
  const normalized = normalizeAmpersand(lower)

  const sorted = [...QUALIFYING_PHRASES].sort((a, b) => b.length - a.length)

  for (const phrase of sorted) {
    const phraseLower = phrase.toLowerCase()
    const idx = normalized.indexOf(phraseLower)
    if (idx === -1) continue

    // Extract text after the qualifying phrase
    const afterPhrase = ocrText.slice(idx + phrase.length).trim()
    // Take up to the next major break (period, newline, or next field indicator)
    const endMatch = afterPhrase.match(/[.\n]|government warning|contains sulfites|\d+%\s*alc/i)
    const endIdx = endMatch?.index ?? Math.min(afterPhrase.length, 200)
    const nameAddress = normalizeWhitespace(afterPhrase.slice(0, endIdx)).replace(/^[,:\s]+/, '')

    if (nameAddress.length > 3) {
      return makeField('name_and_address', nameAddress, 75, `Found name and address after "${phrase}".`)
    }
  }

  // Try City, ST pattern
  const cityStateMatch = ocrText.match(/([A-Z][\w\s]+),\s*([A-Z]{2})\b/)
  if (cityStateMatch) {
    return makeField('name_and_address', cityStateMatch[0].trim(), 60, 'Found City, ST pattern.')
  }

  return makeField('name_and_address', null, 0, 'No name and address found.')
}

function extractStateOfDistillation(ocrText: string): RuleClassifiedField {
  const patterns = [
    /distilled\s+in\s+(\w[\w\s]*)/i,
    /(\w+)\s+straight/i,
  ]

  for (const pattern of patterns) {
    const match = ocrText.match(pattern)
    if (match) {
      return makeField('state_of_distillation', match[0].trim(), 80, 'Matched state of distillation pattern.')
    }
  }

  return makeField('state_of_distillation', null, 0, 'No state of distillation found.')
}

// ---------------------------------------------------------------------------
// Brand / Fanciful name extractors (two-pass, exclusion-based)
// ---------------------------------------------------------------------------

/** Noise words and fragments to skip when scoring brand name candidates */
const NOISE_PATTERNS = [
  /^\d+$/, // pure numbers
  /^[a-z]$/i, // single characters
  /^---/, // image separators
  /^image\s+\d/i,
  /^\(?\d\)/, // section markers like (1), (2)
]

const NOISE_WORDS = new Set([
  'the', 'of', 'and', 'or', 'a', 'an', 'in', 'by', 'for', 'to', 'from',
  'with', 'vol', 'alc', 'proof', 'ml', 'cl', 'oz', 'fl', 'liter', 'litre',
])

/** Regulatory boilerplate to strip before candidate scoring */
const BOILERPLATE_PATTERNS = [
  /government\s+warning[:\s][\s\S]*?(?:health\s+problems|$)/i,
  /---\s*image\s+\d+\s*---/gi,
  /contains?\s+sulfites?/gi,
  /according\s+to\s+the\s+surgeon\s+general/gi,
]

/**
 * Strip known values from OCR text to isolate unidentified text.
 * Case-insensitive replacement.
 */
function stripClaimedValues(text: string, claimed: string[]): string {
  let result = text
  for (const val of claimed) {
    if (!val || val.length < 2) continue
    // Escape regex special chars in the value
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'gi'), '')
  }
  return result
}

/**
 * Strip regulatory boilerplate from OCR text.
 */
function stripBoilerplate(text: string): string {
  let result = text
  for (const pattern of BOILERPLATE_PATTERNS) {
    result = result.replace(pattern, '')
  }
  return result
}

/**
 * Score a candidate line for brand name likelihood.
 * Higher score = more likely to be a brand name.
 */
function scoreBrandCandidate(line: string, lineIndex: number, totalLines: number): number {
  const trimmed = line.trim()
  if (!trimmed) return -1

  // Skip noise
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return -1
  }

  const words = trimmed.split(/\s+/)

  // Skip if all words are noise/stop words
  if (words.every((w) => NOISE_WORDS.has(w.toLowerCase()))) return -1

  let score = 0

  // Position bonus: earlier lines score higher (brand names appear at top)
  score += Math.max(0, 10 - lineIndex * 2)

  // Length preference: 1-4 words ideal for brand names
  if (words.length >= 1 && words.length <= 4) {
    score += 5
  } else if (words.length >= 5 && words.length <= 6) {
    score += 2
  } else {
    // 7+ words — likely a sentence, not a brand name
    score -= 3
  }

  // Capitalization bonus: all-caps or title-case suggests brand
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    score += 3
  }

  // Penalize lines that look like addresses (contain comma + state abbreviation)
  if (/,\s*[A-Z]{2}\b/.test(trimmed)) {
    score -= 5
  }

  return score
}

/**
 * Extract brand name by process of elimination:
 * strip all recognized text, then score remaining lines.
 */
function extractBrandName(
  ocrText: string,
  claimedValues: string[],
): RuleClassifiedField {
  // Strip claimed values and boilerplate
  let cleaned = stripClaimedValues(ocrText, claimedValues)
  cleaned = stripBoilerplate(cleaned)

  // Split into lines, filter empty
  const lines = cleaned
    .split(/\n/)
    .map((l) => normalizeWhitespace(l).trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return makeField('brand_name', null, 0, 'No candidate text remaining after exclusion.')
  }

  // Score each line
  let bestLine = ''
  let bestScore = -Infinity

  for (let i = 0; i < lines.length; i++) {
    const score = scoreBrandCandidate(lines[i], i, lines.length)
    if (score > bestScore) {
      bestScore = score
      bestLine = lines[i]
    }
  }

  if (bestScore < 0 || !bestLine) {
    return makeField('brand_name', null, 0, 'No viable brand name candidate found.')
  }

  return makeField('brand_name', bestLine, 70, `Extracted by exclusion (score: ${bestScore}).`)
}

/**
 * Extract fanciful name (product descriptor / tagline) by exclusion.
 * Same approach as brand name but also excludes the brand name itself,
 * and looks for the second-best candidate.
 */
function extractFancifulName(
  ocrText: string,
  claimedValues: string[],
  brandName: string | null | undefined,
): RuleClassifiedField {
  // Build exclusion set including the brand name
  const exclusions = [...claimedValues]
  if (brandName) exclusions.push(brandName)

  let cleaned = stripClaimedValues(ocrText, exclusions)
  cleaned = stripBoilerplate(cleaned)

  const lines = cleaned
    .split(/\n/)
    .map((l) => normalizeWhitespace(l).trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return makeField('fanciful_name', null, 0, 'No candidate text remaining after exclusion.')
  }

  // Score — prefer lines near the top (fanciful names appear near brand name)
  let bestLine = ''
  let bestScore = -Infinity

  for (let i = 0; i < lines.length; i++) {
    const score = scoreBrandCandidate(lines[i], i, lines.length)
    if (score > bestScore) {
      bestScore = score
      bestLine = lines[i]
    }
  }

  if (bestScore < 0 || !bestLine) {
    return makeField('fanciful_name', null, 0, 'No viable fanciful name candidate found.')
  }

  // Lower confidence than brand name — fanciful names are harder to distinguish
  return makeField('fanciful_name', bestLine, 60, `Extracted by exclusion (score: ${bestScore}).`)
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeField(
  fieldName: string,
  value: string | null,
  confidence: number,
  reasoning: string,
): RuleClassifiedField {
  return { fieldName, value, confidence, wordIndices: [], reasoning }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Rule-based field classifier. Replaces LLM-based classification with
 * pure TypeScript logic: regex, dictionary matching, and fuzzy search.
 *
 * When applicationData is provided (specialist flow), classification is
 * a text-search problem: "find WHERE each expected value appears in the
 * OCR text." This is the critical path — fast and reliable.
 *
 * When applicationData is NOT provided (applicant flow), uses per-field
 * extractors with regex, dictionary matching, and heuristics.
 */
export function ruleClassify(
  ocrText: string,
  beverageType: BeverageType | null,
  applicationData?: Record<string, string>,
): RuleClassificationResult {
  const fields = applicationData && Object.keys(applicationData).length > 0
    ? classifyWithApplicationData(ocrText, beverageType, applicationData)
    : classifyWithoutApplicationData(ocrText, beverageType)

  return {
    fields,
    imageClassifications: [], // Handled separately by classifyImagesFromOcr
    detectedBeverageType: beverageType as
      | 'distilled_spirits'
      | 'wine'
      | 'malt_beverage'
      | null,
  }
}
