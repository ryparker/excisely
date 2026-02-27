import {
  normalizeWhitespace,
  fuzzyMatch,
  normalizeAlcoholContent,
  normalizeNetContents,
  compareField,
} from '@/lib/ai/compare-fields'

// ---------------------------------------------------------------------------
// normalizeWhitespace
// ---------------------------------------------------------------------------

describe('normalizeWhitespace', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello')
  })

  it('collapses multiple spaces into one', () => {
    expect(normalizeWhitespace('hello    world')).toBe('hello world')
  })

  it('collapses tabs and newlines into single space', () => {
    expect(normalizeWhitespace('hello\t\nworld')).toBe('hello world')
  })

  it('handles already-normalized text', () => {
    expect(normalizeWhitespace('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(normalizeWhitespace('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// fuzzyMatch
// ---------------------------------------------------------------------------

describe('fuzzyMatch', () => {
  it('returns exact match for identical strings', () => {
    const result = fuzzyMatch('Bulleit Bourbon', 'Bulleit Bourbon')
    expect(result).toEqual({ match: true, similarity: 1 })
  })

  it('returns exact match for case-insensitive identical strings', () => {
    const result = fuzzyMatch('BULLEIT BOURBON', 'bulleit bourbon')
    expect(result).toEqual({ match: true, similarity: 1 })
  })

  it('normalizes whitespace before comparing', () => {
    const result = fuzzyMatch('Bulleit  Bourbon', 'Bulleit Bourbon')
    expect(result).toEqual({ match: true, similarity: 1 })
  })

  it('returns high similarity for strings with minor differences', () => {
    const result = fuzzyMatch('Bulleit Bourbon', 'Bulleit Bourbo')
    expect(result.match).toBe(true)
    expect(result.similarity).toBeGreaterThanOrEqual(0.8)
  })

  it('returns mismatch for completely different strings', () => {
    const result = fuzzyMatch('Bulleit Bourbon', 'Jack Daniels')
    expect(result.match).toBe(false)
    expect(result.similarity).toBeLessThan(0.8)
  })

  it('handles single-character strings by falling back to equality', () => {
    const result = fuzzyMatch('A', 'A')
    expect(result).toEqual({ match: true, similarity: 1 })
  })

  it('handles single-character mismatch', () => {
    const result = fuzzyMatch('A', 'B')
    expect(result).toEqual({ match: false, similarity: 0 })
  })
})

// ---------------------------------------------------------------------------
// normalizeAlcoholContent
// ---------------------------------------------------------------------------

describe('normalizeAlcoholContent', () => {
  it('parses "45% Alc./Vol." format', () => {
    expect(normalizeAlcoholContent('45% Alc./Vol.')).toBe(45)
  })

  it('parses "45% ABV" format', () => {
    expect(normalizeAlcoholContent('45% ABV')).toBe(45)
  })

  it('parses bare percentage "12.5%"', () => {
    expect(normalizeAlcoholContent('12.5%')).toBe(12.5)
  })

  it('converts proof to ABV ("90 Proof" -> 45)', () => {
    expect(normalizeAlcoholContent('90 Proof')).toBe(45)
  })

  it('handles decimal proof ("101.5 Proof" -> 50.75)', () => {
    expect(normalizeAlcoholContent('101.5 Proof')).toBe(50.75)
  })

  it('returns null for unparseable string', () => {
    expect(normalizeAlcoholContent('forty-five percent')).toBeNull()
  })

  it('prioritizes proof over percentage when proof appears first', () => {
    // "90 proof" should match the proof regex first
    expect(normalizeAlcoholContent('90 proof')).toBe(45)
  })
})

// ---------------------------------------------------------------------------
// normalizeNetContents
// ---------------------------------------------------------------------------

describe('normalizeNetContents', () => {
  it('parses "750 mL"', () => {
    expect(normalizeNetContents('750 mL')).toBe(750)
  })

  it('parses "750ml" (no space)', () => {
    expect(normalizeNetContents('750ml')).toBe(750)
  })

  it('parses "75 cL" to 750 mL', () => {
    expect(normalizeNetContents('75 cL')).toBe(750)
  })

  it('parses "1.5 L" to 1500 mL', () => {
    expect(normalizeNetContents('1.5 L')).toBe(1500)
  })

  it('parses "1 Liter" to 1000 mL', () => {
    expect(normalizeNetContents('1 Liter')).toBe(1000)
  })

  it('parses "25.4 FL OZ" to fluid ounces in mL', () => {
    const result = normalizeNetContents('25.4 fl oz')
    expect(result).not.toBeNull()
    // 25.4 * 29.5735 ≈ 751.17
    expect(result).toBeCloseTo(751.17, 0)
  })

  it('parses "12 oz" to mL', () => {
    const result = normalizeNetContents('12 oz')
    expect(result).not.toBeNull()
    // 12 * 29.5735 ≈ 354.88
    expect(result).toBeCloseTo(354.88, 0)
  })

  it('parses "1 gallon" to 3785.41 mL', () => {
    expect(normalizeNetContents('1 gallon')).toBe(3785.41)
  })

  it('returns null for unparseable input', () => {
    expect(normalizeNetContents('large bottle')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// compareField — "not_found" when extracted is null/empty
// ---------------------------------------------------------------------------

describe('compareField — not_found', () => {
  it('returns not_found when extracted is null', () => {
    const result = compareField('brand_name', 'Bulleit', null)
    expect(result.status).toBe('not_found')
    expect(result.confidence).toBe(0)
    expect(result.reasoning).toContain('brand_name')
  })

  it('returns not_found when extracted is empty string', () => {
    const result = compareField('brand_name', 'Bulleit', '')
    expect(result.status).toBe('not_found')
  })

  it('returns not_found when extracted is whitespace only', () => {
    const result = compareField('brand_name', 'Bulleit', '   ')
    expect(result.status).toBe('not_found')
  })
})

// ---------------------------------------------------------------------------
// compareField — exact strategy
// ---------------------------------------------------------------------------

describe('compareField — exact strategy', () => {
  it('matches identical health warning text', () => {
    const warning = 'GOVERNMENT WARNING: (1) According to the Surgeon General'
    const result = compareField('health_warning', warning, warning)
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })

  it('matches health warning case-insensitively with floor confidence', () => {
    const expected = 'GOVERNMENT WARNING: Test'
    const extracted = 'government warning: test'
    const result = compareField('health_warning', expected, extracted)
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('matches vintage year with extra characters stripped', () => {
    const result = compareField('vintage_year', '2021', 'Vintage 2021')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('returns mismatch for different vintage years', () => {
    const result = compareField('vintage_year', '2021', '2019')
    expect(result.status).toBe('mismatch')
  })

  it('returns mismatch for completely different health warning', () => {
    const result = compareField(
      'health_warning',
      'GOVERNMENT WARNING: A',
      'Something else entirely different from the warning',
    )
    expect(result.status).toBe('mismatch')
  })
})

// ---------------------------------------------------------------------------
// compareField — fuzzy strategy
// ---------------------------------------------------------------------------

describe('compareField — fuzzy strategy', () => {
  it('matches identical brand names', () => {
    const result = compareField(
      'brand_name',
      'Bulleit Bourbon',
      'Bulleit Bourbon',
    )
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })

  it('matches brand names with minor OCR differences', () => {
    const result = compareField(
      'brand_name',
      'Bulleit Bourbon',
      'Bulleit Bourb0n',
    )
    expect(result.status).toBe('match')
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })

  it('matches when extracted contains expected (partial OCR)', () => {
    const result = compareField(
      'fanciful_name',
      'Frontier',
      'Frontier Whiskey Special',
    )
    expect(result.status).toBe('match')
  })

  it('matches when expected contains extracted (partial OCR)', () => {
    const result = compareField('fanciful_name', 'Frontier Whiskey', 'Frontier')
    expect(result.status).toBe('match')
  })

  it('returns mismatch for completely different names', () => {
    const result = compareField('brand_name', 'Bulleit', 'Jack Daniels')
    expect(result.status).toBe('mismatch')
  })
})

// ---------------------------------------------------------------------------
// compareField — normalized strategy (alcohol_content)
// ---------------------------------------------------------------------------

describe('compareField — normalized alcohol_content', () => {
  it('matches identical ABV values', () => {
    const result = compareField('alcohol_content', '45% Alc./Vol.', '45% ABV')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })

  it('matches proof to percentage (90 Proof = 45%)', () => {
    const result = compareField('alcohol_content', '45% Alc./Vol.', '90 Proof')
    expect(result.status).toBe('match')
  })

  it('matches within 0.5% tolerance', () => {
    const result = compareField('alcohol_content', '12.5% ABV', '12.8% ABV')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('returns mismatch outside tolerance', () => {
    const result = compareField('alcohol_content', '12.5% ABV', '14% ABV')
    expect(result.status).toBe('mismatch')
  })

  it('falls back to fuzzy when values cannot be parsed', () => {
    const result = compareField(
      'alcohol_content',
      'forty-five percent',
      'forty-five percent',
    )
    expect(result.status).toBe('match')
  })
})

// ---------------------------------------------------------------------------
// compareField — normalized strategy (net_contents)
// ---------------------------------------------------------------------------

describe('compareField — normalized net_contents', () => {
  it('matches same volume in different units (750 mL = 75 cL)', () => {
    const result = compareField('net_contents', '750 mL', '75 cL')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })

  it('matches within 1% tolerance', () => {
    const result = compareField('net_contents', '750 mL', '25.4 fl oz')
    // 25.4 fl oz ≈ 751.17 mL, within 1% of 750
    expect(result.status).toBe('match')
  })

  it('returns mismatch for different volumes', () => {
    const result = compareField('net_contents', '750 mL', '1 L')
    expect(result.status).toBe('mismatch')
  })

  it('falls back to fuzzy when values cannot be parsed', () => {
    const result = compareField(
      'net_contents',
      'standard bottle',
      'standard bottle',
    )
    expect(result.status).toBe('match')
  })
})

// ---------------------------------------------------------------------------
// compareField — normalized strategy (age_statement)
// ---------------------------------------------------------------------------

describe('compareField — normalized age_statement', () => {
  it('matches equivalent age statements', () => {
    const result = compareField('age_statement', 'Aged 10 Years', '10 Year Old')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })

  it('returns mismatch for different ages', () => {
    const result = compareField(
      'age_statement',
      'Aged 10 Years',
      'Aged 12 Years',
    )
    expect(result.status).toBe('mismatch')
  })

  it('falls back to fuzzy when age cannot be parsed', () => {
    const result = compareField('age_statement', 'Well Aged', 'Well Aged')
    expect(result.status).toBe('match')
  })
})

// ---------------------------------------------------------------------------
// compareField — contains strategy
// ---------------------------------------------------------------------------

describe('compareField — contains strategy', () => {
  it('matches when expected is contained in extracted', () => {
    const result = compareField(
      'country_of_origin',
      'France',
      'Product of France',
    )
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('matches when extracted is contained in expected', () => {
    const result = compareField(
      'country_of_origin',
      'Product of France',
      'France',
    )
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('matches on word-level overlap (>=50%)', () => {
    const result = compareField(
      'country_of_origin',
      'United States of America',
      'United States',
    )
    expect(result.status).toBe('match')
  })

  it('returns mismatch for completely different countries', () => {
    const result = compareField('country_of_origin', 'France', 'Scotland')
    expect(result.status).toBe('mismatch')
  })
})

// ---------------------------------------------------------------------------
// compareField — enum strategy
// ---------------------------------------------------------------------------

describe('compareField — enum strategy', () => {
  it('matches same qualifying phrase', () => {
    const result = compareField('qualifying_phrase', 'Bottled by', 'bottled by')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('matches qualifying phrase within longer text', () => {
    const result = compareField(
      'qualifying_phrase',
      'Distilled by',
      'Distilled by Company Name',
    )
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(95)
  })

  it('returns mismatch for different qualifying phrases', () => {
    const result = compareField(
      'qualifying_phrase',
      'Bottled by',
      'Distilled by',
    )
    expect(result.status).toBe('mismatch')
    expect(result.confidence).toBe(90)
  })

  it('falls back to fuzzy when phrase is not a known enum', () => {
    const result = compareField(
      'qualifying_phrase',
      'Custom phrase xyz',
      'Custom phrase xyz',
    )
    expect(result.status).toBe('match')
  })
})

// ---------------------------------------------------------------------------
// compareField — matchType override
// ---------------------------------------------------------------------------

describe('compareField — matchType override', () => {
  it('uses explicit matchType over field-name strategy', () => {
    // brand_name normally uses fuzzy, but override to exact
    const result = compareField('brand_name', 'Bulleit', 'bulleit', 'exact')
    // exact comparison: "Bulleit" !== "bulleit" but for non health_warning/vintage_year, returns mismatch
    expect(result.status).toBe('mismatch')
  })

  it('uses fuzzy as default for unknown field names', () => {
    const result = compareField('unknown_field', 'Bulleit', 'Bulleit')
    expect(result.status).toBe('match')
    expect(result.confidence).toBe(100)
  })
})
