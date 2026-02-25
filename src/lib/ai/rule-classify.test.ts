import { ruleClassify } from '@/lib/ai/rule-classify'

// ---------------------------------------------------------------------------
// Specialist flow: application data provided (text search)
// ---------------------------------------------------------------------------

describe('ruleClassify — with application data (specialist flow)', () => {
  const ocrText = `BULLEIT BOURBON
Kentucky Straight Bourbon Whiskey
Frontier Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Distilled and Bottled by The Bulleit Distilling Co., Louisville, KY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.
Aged 6 Years
Product of USA`

  it('finds exact matches in OCR text', () => {
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      brand_name: 'BULLEIT',
      alcohol_content: '45% Alc./Vol.',
    })

    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBe('BULLEIT')
    expect(brandField?.confidence).toBeGreaterThanOrEqual(90)

    const alcField = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(alcField?.value).toBe('45% Alc./Vol.')
    expect(alcField?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('handles fuzzy matches for OCR errors', () => {
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      brand_name: 'BULLEIT BOURBON',
      net_contents: '750 mL',
    })

    const netField = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(netField?.value).toBe('750 mL')
    expect(netField?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('normalizes ampersands for qualifying phrases', () => {
    const ocrWithAmpersand = 'Produced & Bottled by Some Company, City, ST'
    const result = ruleClassify(ocrWithAmpersand, 'distilled_spirits', {
      qualifying_phrase: 'Produced and Bottled by',
    })

    const qpField = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(qpField?.value).toBe('Produced and Bottled by')
    expect(qpField?.confidence).toBeGreaterThanOrEqual(90)
  })

  it('handles space-collapsed matches', () => {
    const ocrWithNoSpace = '750mL net contents'
    const result = ruleClassify(ocrWithNoSpace, 'distilled_spirits', {
      net_contents: '750 mL',
    })

    const netField = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(netField?.value).toBe('750 mL')
    expect(netField?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('returns null for fields not found in OCR text', () => {
    const result = ruleClassify('some random text', 'distilled_spirits', {
      brand_name: 'DEFINITELY NOT HERE',
    })

    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBeNull()
    expect(brandField?.confidence).toBe(0)
  })

  it('returns zero usage (no LLM)', () => {
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      brand_name: 'BULLEIT',
    })
    expect(result.imageClassifications).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Applicant flow: no application data (extraction)
// ---------------------------------------------------------------------------

describe('ruleClassify — without application data (extraction)', () => {
  it('extracts health warning by GOVERNMENT WARNING prefix', () => {
    const ocrText = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`

    const result = ruleClassify(ocrText, 'distilled_spirits')
    const hwField = result.fields.find((f) => f.fieldName === 'health_warning')
    expect(hwField?.value).toBeTruthy()
    expect(hwField?.confidence).toBeGreaterThan(0)
  })

  it('extracts alcohol content from standard format', () => {
    const ocrText = 'This label shows 45% Alc./Vol. on the front'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const alcField = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(alcField?.value).toContain('45%')
    expect(alcField?.confidence).toBeGreaterThan(80)
  })

  it('extracts alcohol content from proof', () => {
    const ocrText = 'This bourbon is 90 proof'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const alcField = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(alcField?.value).toContain('90')
    expect(alcField?.value?.toLowerCase()).toContain('proof')
  })

  it('extracts net contents', () => {
    const ocrText = 'Volume: 750 mL bottle'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const netField = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(netField?.value).toContain('750')
    expect(netField?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('extracts qualifying phrase — single', () => {
    const ocrText = 'Bottled by Jim Beam, Clermont, KY'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const qpField = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(qpField?.value).toBe('Bottled by')
  })

  it('extracts qualifying phrase — compound', () => {
    const ocrText = 'Distilled and Bottled by Four Roses, Lawrenceburg, KY'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const qpField = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(qpField?.value).toBe('Distilled and Bottled by')
  })

  it('prefers compound qualifying phrases over simple ones', () => {
    const ocrText = 'Produced and Bottled by Some Winery'
    const result = ruleClassify(ocrText, 'wine')
    const qpField = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    // Should match "Produced and Bottled by", not just "Bottled by"
    expect(qpField?.value).toBe('Produced and Bottled by')
  })

  it('extracts sulfite declaration', () => {
    const ocrText = 'Contains Sulfites. 750 mL. 13.5% Alc/Vol'
    const result = ruleClassify(ocrText, 'wine')
    const sulfField = result.fields.find((f) => f.fieldName === 'sulfite_declaration')
    expect(sulfField?.value).toBe('Contains Sulfites')
  })

  it('extracts vintage year', () => {
    const ocrText = 'Napa Valley 2021 Cabernet Sauvignon'
    const result = ruleClassify(ocrText, 'wine')
    const vintField = result.fields.find((f) => f.fieldName === 'vintage_year')
    expect(vintField?.value).toBe('2021')
  })

  it('extracts grape varietal', () => {
    const ocrText = 'Napa Valley 2021 Cabernet Sauvignon'
    const result = ruleClassify(ocrText, 'wine')
    const grapeField = result.fields.find((f) => f.fieldName === 'grape_varietal')
    expect(grapeField?.value).toBe('Cabernet Sauvignon')
  })

  it('extracts appellation of origin', () => {
    const ocrText = 'Napa Valley 2021 Cabernet Sauvignon'
    const result = ruleClassify(ocrText, 'wine')
    const appField = result.fields.find((f) => f.fieldName === 'appellation_of_origin')
    expect(appField?.value).toBe('Napa Valley')
  })

  it('extracts age statement', () => {
    const ocrText = 'Aged 12 Years in oak barrels'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const ageField = result.fields.find((f) => f.fieldName === 'age_statement')
    expect(ageField?.value).toContain('Aged 12 Years')
  })

  it('extracts country of origin', () => {
    const ocrText = 'Product of Scotland. Imported by Diageo'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const countryField = result.fields.find((f) => f.fieldName === 'country_of_origin')
    expect(countryField?.value).toContain('Product of Scotland')
  })

  it('extracts class/type from TTB code descriptions', () => {
    const ocrText = 'Kentucky Straight Bourbon Whiskey, 750 mL'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const classField = result.fields.find((f) => f.fieldName === 'class_type')
    expect(classField?.value).toContain('Kentucky Straight Bourbon Whiskey')
  })

  it('returns all fields for the given beverage type', () => {
    const ocrText = 'Some label text'
    const result = ruleClassify(ocrText, 'wine')

    const fieldNames = result.fields.map((f) => f.fieldName)
    expect(fieldNames).toContain('brand_name')
    expect(fieldNames).toContain('health_warning')
    expect(fieldNames).toContain('sulfite_declaration')
    expect(fieldNames).toContain('grape_varietal')
  })

  it('returns all fields from all types when beverageType is null', () => {
    const ocrText = 'Some label text'
    const result = ruleClassify(ocrText, null)

    const fieldNames = result.fields.map((f) => f.fieldName)
    // Should have fields from all beverage types
    expect(fieldNames).toContain('grape_varietal') // wine
    expect(fieldNames).toContain('age_statement') // spirits
    expect(fieldNames).toContain('brand_name') // all types
  })

  it('extracts name and address after qualifying phrase', () => {
    const ocrText = 'Bottled by Jim Beam, Clermont, KY 40110'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const naField = result.fields.find((f) => f.fieldName === 'name_and_address')
    expect(naField?.value).toBeTruthy()
    expect(naField?.value).toContain('Jim Beam')
  })
})

// ---------------------------------------------------------------------------
// Brand name extraction (two-pass, exclusion-based)
// ---------------------------------------------------------------------------

describe('ruleClassify — brand name extraction', () => {
  it('extracts brand name from top of wine label', () => {
    const ocrText = `CHATEAU MONTELENA
Napa Valley
2021 Cabernet Sauvignon
750 mL
13.5% Alc./Vol.
Produced and Bottled by Chateau Montelena Winery, Calistoga, CA
Contains Sulfites
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`

    const result = ruleClassify(ocrText, 'wine')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBeTruthy()
    expect(brandField?.value!.toUpperCase()).toContain('CHATEAU MONTELENA')
    expect(brandField?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('extracts brand name from bourbon label', () => {
    const ocrText = `BULLEIT BOURBON
Kentucky Straight Bourbon Whiskey
Frontier Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Distilled and Bottled by The Bulleit Distilling Co., Louisville, KY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.
Product of USA`

    const result = ruleClassify(ocrText, 'distilled_spirits')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBeTruthy()
    expect(brandField?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('does not return claimed values as brand name', () => {
    const ocrText = `OLD FORESTER
Kentucky Straight Bourbon Whiskey
750 mL
43% Alc./Vol.`

    const result = ruleClassify(ocrText, 'distilled_spirits')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    const alcField = result.fields.find((f) => f.fieldName === 'alcohol_content')

    // Brand should NOT be the alcohol content
    expect(brandField?.value).not.toBe(alcField?.value)
  })

  it('returns null brand name for empty text', () => {
    const result = ruleClassify('', 'distilled_spirits')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Fanciful name extraction
// ---------------------------------------------------------------------------

describe('ruleClassify — fanciful name extraction', () => {
  it('extracts fanciful name distinct from brand name', () => {
    const ocrText = `BULLEIT BOURBON
Frontier Whiskey
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Distilled and Bottled by The Bulleit Distilling Co., Louisville, KY
Product of USA`

    const result = ruleClassify(ocrText, 'distilled_spirits')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    const fancifulField = result.fields.find((f) => f.fieldName === 'fanciful_name')

    expect(brandField?.value).toBeTruthy()
    expect(fancifulField?.value).toBeTruthy()
    // Brand and fanciful should be different
    expect(fancifulField?.value).not.toBe(brandField?.value)
    expect(fancifulField?.confidence).toBeGreaterThanOrEqual(50)
  })

  it('has lower confidence than brand name', () => {
    const ocrText = `JACK DANIEL'S
Old No. 7
Tennessee Whiskey
40% Alc./Vol.
750 mL`

    const result = ruleClassify(ocrText, 'distilled_spirits')
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    const fancifulField = result.fields.find((f) => f.fieldName === 'fanciful_name')

    if (brandField?.value && fancifulField?.value) {
      expect(fancifulField.confidence).toBeLessThanOrEqual(brandField.confidence)
    }
  })
})

// ---------------------------------------------------------------------------
// Country of origin fix
// ---------------------------------------------------------------------------

describe('ruleClassify — country of origin fix', () => {
  it('extracts clean "Product of USA" without trailing words', () => {
    const ocrText = 'Product of USA as all American spirits should be. 750 mL.'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const field = result.fields.find((f) => f.fieldName === 'country_of_origin')
    expect(field?.value).toBe('Product of USA')
  })

  it('extracts multi-word country names (up to 3 words)', () => {
    const ocrText = 'Product of United Kingdom of England'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const field = result.fields.find((f) => f.fieldName === 'country_of_origin')
    expect(field?.value).toBe('Product of United Kingdom of')
  })

  it('handles "Imported from" prefix', () => {
    const ocrText = 'Imported from Scotland by Diageo'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const field = result.fields.find((f) => f.fieldName === 'country_of_origin')
    expect(field?.value).toContain('Scotland')
    expect(field?.value).toContain('Imported from')
  })

  it('handles "Made in" prefix', () => {
    const ocrText = 'Made in Mexico from 100% agave'
    const result = ruleClassify(ocrText, 'distilled_spirits')
    const field = result.fields.find((f) => f.fieldName === 'country_of_origin')
    // Stops at "from" (stop word) — country is "Mexico"
    expect(field?.value).toBe('Made in Mexico')
  })
})

// ---------------------------------------------------------------------------
// Punctuation-stripped matching
// ---------------------------------------------------------------------------

describe('ruleClassify — punctuation-stripped matching', () => {
  it('matches when OCR drops trailing period (Vol. → Vol)', () => {
    const ocrText = 'ALC. 14.5% BY VOL some other text'
    const result = ruleClassify(ocrText, 'wine', {
      alcohol_content: 'Alc. 14.5% By Vol.',
    })
    const f = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(f?.value).toBe('Alc. 14.5% By Vol.')
    expect(f?.confidence).toBe(88)
  })

  it('matches when OCR adds extra period (OZ vs OZ.)', () => {
    const ocrText = '12 FL. OZ. (355 ML) brewed fresh'
    const result = ruleClassify(ocrText, 'malt_beverage', {
      net_contents: '12 FL. OZ (355 ML)',
    })
    const f = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(f?.value).toBe('12 FL. OZ (355 ML)')
    expect(f?.confidence).toBeGreaterThanOrEqual(85)
  })

  it('matches punctuation-stripped + space-collapsed', () => {
    const ocrText = '12FL.OZ.(355ML) brewed fresh'
    const result = ruleClassify(ocrText, 'malt_beverage', {
      net_contents: '12 FL. OZ (355 ML)',
    })
    const f = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(f?.value).toBe('12 FL. OZ (355 ML)')
    expect(f?.confidence).toBe(85)
  })
})

// ---------------------------------------------------------------------------
// Fuzzy sliding window matching
// ---------------------------------------------------------------------------

describe('ruleClassify — fuzzy sliding window', () => {
  it('finds name_and_address despite OCR misspelling', () => {
    const ocrText =
      'OLD TOM VODKA PREMIUM DISTILLED & BOTTLED BY OLD TOM DISTILLERY LONSVILLE KY 750 ML'
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      name_and_address: 'Old Tom Distillery, Louisville, KY',
    })
    const f = result.fields.find((f) => f.fieldName === 'name_and_address')
    expect(f?.value).toBe('Old Tom Distillery, Louisville, KY')
    expect(f?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('finds qualifying_phrase despite OCR typo via ampersand fuzzy window', () => {
    const ocrText =
      'VINE HAVEN CHARDONNAY DUCED & BOTTLED BY VINEWEIN WINES SOUTH AUSTRALIA'
    const result = ruleClassify(ocrText, 'wine', {
      qualifying_phrase: 'Produced and Bottled by',
    })
    const f = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(f?.value).toBe('Produced and Bottled by')
    expect(f?.confidence).toBeGreaterThanOrEqual(70)
  })

  it('does not match completely garbled text', () => {
    const ocrText = 'XYZABC RANDOM GIBBERISH NOTHING MATCHES HERE'
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      brand_name: 'Old Tom Distillery',
    })
    const f = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(f?.value).toBeNull()
    expect(f?.confidence).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Fuzzy qualifying phrase extraction (applicant flow)
// ---------------------------------------------------------------------------

describe('ruleClassify — fuzzy qualifying phrase extraction', () => {
  it('extracts qualifying phrase with OCR typo (BOTILED → BOTTLED)', () => {
    const ocrText = 'PRODUCED AND BOTILED BY Some Winery, Napa, CA'
    const result = ruleClassify(ocrText, 'wine')
    const f = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(f?.value).toBe('Produced and Bottled by')
    expect(f?.confidence).toBeGreaterThanOrEqual(80)
  })

  it('matches "Bottled by" exactly when "DUCED" truncation is present', () => {
    // When OCR truncates "PRODUCED" to "DUCED", the exact match for the shorter
    // phrase "Bottled by" fires first — this is correct extraction behavior
    const ocrText = 'DUCED AND BOTTLED BY Some Winery, Napa, CA'
    const result = ruleClassify(ocrText, 'wine')
    const f = result.fields.find((f) => f.fieldName === 'qualifying_phrase')
    expect(f?.value).toBe('Bottled by')
    expect(f?.confidence).toBeGreaterThanOrEqual(90)
  })
})

// ---------------------------------------------------------------------------
// Token overlap matching
// ---------------------------------------------------------------------------

describe('ruleClassify — token overlap matching', () => {
  it('finds alcohol_content when tokens are scattered across OCR text', () => {
    // Simulates Bulleit Old Fashioned OCR: alcohol info fragmented across lines
    const ocrText =
      'BULLEIT OLD FASHIONED cohol by volume: 37.5% (75 pr ALC BY (75 PROOF) vou 00m'
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      alcohol_content: '37.5% Alc. By Vol. (75 Proof)',
    })
    const f = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(f?.value).toBe('37.5% Alc. By Vol. (75 Proof)')
    expect(f?.confidence).toBeGreaterThanOrEqual(75)
  })

  it('does not activate for fields with fewer than 3 significant tokens', () => {
    // "100 mL" has only 1 significant token (len >= 3 after punct strip)
    const ocrText = 'RANDOM TEXT NOTHING USEFUL 00m some words here'
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      net_contents: '100 mL',
    })
    const f = result.fields.find((f) => f.fieldName === 'net_contents')
    expect(f?.confidence).toBe(0)
  })

  it('does not false-positive on unrelated text', () => {
    const ocrText = 'TOTALLY DIFFERENT PRODUCT LABEL WITH NO MATCHING TOKENS'
    const result = ruleClassify(ocrText, 'distilled_spirits', {
      alcohol_content: '37.5% Alc. By Vol. (75 Proof)',
    })
    const f = result.fields.find((f) => f.fieldName === 'alcohol_content')
    expect(f?.confidence).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ruleClassify — edge cases', () => {
  it('handles empty OCR text', () => {
    const result = ruleClassify('', 'distilled_spirits', {
      brand_name: 'Test',
    })
    const brandField = result.fields.find((f) => f.fieldName === 'brand_name')
    expect(brandField?.value).toBeNull()
    expect(brandField?.confidence).toBe(0)
  })

  it('handles empty application data', () => {
    const result = ruleClassify('Some text', 'distilled_spirits', {})
    // Should fall through to extraction mode
    expect(result.fields.length).toBeGreaterThan(0)
  })

  it('returns detected beverage type from input', () => {
    const result = ruleClassify('Some text', 'wine')
    expect(result.detectedBeverageType).toBe('wine')
  })

  it('returns null beverage type when none provided', () => {
    const result = ruleClassify('Some text', null)
    expect(result.detectedBeverageType).toBeNull()
  })
})
