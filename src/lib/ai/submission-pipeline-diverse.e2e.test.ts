// @vitest-environment node

/**
 * Diverse end-to-end tests for the specialist submission pipeline.
 *
 * Tests the full pipeline (OCR → rule-based classification) against a mix
 * of real-world labels and AI-generated labels across all three beverage
 * types: wine, distilled spirits, and malt beverages.
 *
 * Real-world labels test OCR robustness with varied fonts, colors, layouts,
 * and photography conditions. AI-generated labels test clean extraction.
 *
 * No mocks — uses the actual Tesseract.js WASM engine. ~2-10s per test.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractTextMultiImage } from '@/lib/ai/ocr'
import { classifyFieldsForSubmission } from '@/lib/ai/classify-fields'

const AI_DIR = join(process.cwd(), 'test-labels/ai-generated')
const WHISKEY_DIR = join(process.cwd(), 'test-labels/whiskey')
const WINE_DIR = join(process.cwd(), 'test-labels/wine')
const BEER_DIR = join(process.cwd(), 'test-labels/beer')

type Fields = Array<{
  fieldName: string
  value: string | null
  confidence: number
  reasoning: string | null
}>

/** Helper to find a classified field by name */
function getField(fields: Fields, name: string) {
  return fields.find((f) => f.fieldName === name)
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-world labels
// ─────────────────────────────────────────────────────────────────────────────

describe('Submission pipeline — real-world labels', () => {
  describe('Three Fox Viognier Reserve (wine, front+back, Virginia)', () => {
    let fields: Fields

    it('runs OCR and classification on front+back pair', async () => {
      const front = readFileSync(join(WINE_DIR, 'three-fox-viognier-front.png'))
      const back = readFileSync(join(WINE_DIR, 'three-fox-viognier-back.png'))
      const ocrResults = await extractTextMultiImage([front, back])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(2)

      const { result } = await classifyFieldsForSubmission(fullText, 'wine', {
        brand_name: 'Three Fox Vineyards',
        fanciful_name: 'Viognier Reserve',
        class_type: 'Table Wine',
        alcohol_content: '12.5% By Vol.',
        net_contents: '750mL',
        health_warning:
          'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        name_and_address: 'Three Fox Vineyards, Delaplane, VA',
        qualifying_phrase: 'Produced and Bottled by',
        grape_varietal: 'Viognier',
        appellation_of_origin: 'Virginia',
        sulfite_declaration: 'Contains Sulfites',
        vintage_year: '2020',
      })

      fields = result.fields
    }, 60_000)

    it('finds brand_name from back label text', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Three Fox Vineyards')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds fanciful_name "Viognier Reserve"', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Viognier Reserve')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds grape_varietal', () => {
      const f = getField(fields, 'grape_varietal')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Viognier')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750mL')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds sulfite_declaration', () => {
      const f = getField(fields, 'sulfite_declaration')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Contains Sulfites')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds vintage_year', () => {
      const f = getField(fields, 'vintage_year')
      expect(f).toBeDefined()
      expect(f!.value).toBe('2020')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('fails to find class_type ("Table Wine" not printed on label)', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds qualifying_phrase via fuzzy sliding window', () => {
      // OCR produces "BOTILED" instead of "BOTTLED" — fuzzy match handles it
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Produced and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Cooper Ridge Malbec (wine, front+back, Oregon)', () => {
    let fields: Fields

    it('runs OCR and classification on front+back pair', async () => {
      const front = readFileSync(join(WINE_DIR, 'cooper-ridge-malbec-front.png'))
      const back = readFileSync(join(WINE_DIR, 'cooper-ridge-malbec-back.png'))
      const ocrResults = await extractTextMultiImage([front, back])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(2)

      const { result } = await classifyFieldsForSubmission(fullText, 'wine', {
        brand_name: 'Cooper Ridge',
        class_type: 'Malbec',
        alcohol_content: 'Alc. 13% by Vol.',
        net_contents: '750 ml',
        health_warning:
          'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        name_and_address:
          'Cooper Ridge Vineyard, 1389 Old Garden Valley Road, Roseburg, Oregon',
        qualifying_phrase: 'Grown, Produced and Bottled by',
        grape_varietal: 'Malbec',
        appellation_of_origin: 'Umpqua Valley',
        sulfite_declaration: 'Contains Sulfites',
        vintage_year: '2022',
        country_of_origin: 'Product of USA',
      })

      fields = result.fields
    }, 60_000)

    it('finds brand_name from prominent front text', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Cooper Ridge')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type / grape_varietal "Malbec"', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Malbec')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds grape_varietal', () => {
      const f = getField(fields, 'grape_varietal')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Malbec')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds appellation_of_origin "Umpqua Valley"', () => {
      const f = getField(fields, 'appellation_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Umpqua Valley')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds vintage_year "2022"', () => {
      const f = getField(fields, 'vintage_year')
      expect(f).toBeDefined()
      expect(f!.value).toBe('2022')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('fails to find alcohol_content (back label text garbled by OCR)', () => {
      // OCR produces "Hc 126" instead of "Alc. 13% by Vol."
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds qualifying_phrase via fuzzy sliding window', () => {
      // OCR garbles back text — fuzzy match handles it
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Grown, Produced and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Forever Summer Mediterranee (wine, real French rose)', () => {
    let fields: Fields

    it('runs OCR and classification on front+back pair', async () => {
      const front = readFileSync(join(WINE_DIR, 'forever-summer-front.png'))
      const back = readFileSync(join(WINE_DIR, 'forever-summer-back.png'))
      const ocrResults = await extractTextMultiImage([front, back])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(2)

      const { result } = await classifyFieldsForSubmission(fullText, 'wine', {
        brand_name: 'Forever Summer',
        fanciful_name: 'Mediterranee',
        class_type: 'Rose Wine',
        alcohol_content: 'Alc. 12.5% By Vol.',
        net_contents: '750 ML',
        health_warning:
          'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        name_and_address: 'Twenty-One Wine and Spirits, Miami, FL',
        qualifying_phrase: 'Imported by',
        sulfite_declaration: 'Contains Sulfites',
        country_of_origin: 'Product of France',
        appellation_of_origin: "Appellation d'Origine Controlee",
      })

      fields = result.fields
    }, 60_000)

    it('finds brand_name "Forever Summer"', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Forever Summer')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds fanciful_name "Mediterranee"', () => {
      // OCR reads the stylized text from the front label
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Mediterranee')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds country_of_origin "Product of France"', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Product of France')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('fails to find class_type (OCR reads "Ross wine" not "Rose Wine")', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('fails to find alcohol_content (OCR squashes spacing)', () => {
      // OCR produces "ALC 2S%EIVOL" — garbled
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })
  })

  describe('Twisted Tea Light Lemon (malt beverage, real colorful label)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(
        join(BEER_DIR, 'twisted-tea-light-lemon-front.png'),
      )
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'malt_beverage',
        {
          brand_name: 'Twisted Tea',
          fanciful_name: 'Light',
          class_type: 'Hard Iced Tea',
          alcohol_content: '4% Alc./Vol.',
          net_contents: '12 FL. OZ.',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        },
      )

      fields = result.fields
    }, 30_000)

    it('finds alcohol_content despite busy label design', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('4% Alc./Vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds brand_name via fuzzy sliding window', () => {
      // OCR produces "AWISTED TE4" instead of "TWISTED TEA" — fuzzy match handles it
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Twisted Tea')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('fails to find fanciful_name (stylized "Light" text)', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds class_type via fuzzy sliding window', () => {
      // OCR reads "WARD ICED TE," — fuzzy match handles it
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Hard Iced Tea')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Bulleit Old Fashioned (spirits, ready-to-drink cocktail)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(
        join(WHISKEY_DIR, 'bulleit-old-fashioned/front.png'),
      )
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(20)

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        {
          brand_name: 'Bulleit',
          fanciful_name: 'Old Fashioned',
          class_type: 'Bourbon Whiskey',
          alcohol_content: '37.5% Alc. By Vol. (75 Proof)',
          net_contents: '100 mL',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address:
            'Bulleit Cocktail Co., New York, NY',
          qualifying_phrase: 'Canned by',
        },
      )

      fields = result.fields
    }, 30_000)

    it('finds brand_name "Bulleit"', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Bulleit')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds fanciful_name "Old Fashioned"', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Old Fashioned')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content via token overlap', () => {
      // OCR fragments across lines: "37.5%", "ALC", "BY", "VOL" (in "volume:"), "PROOF"
      // Token overlap finds 4/4 significant tokens scattered in OCR text
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('37.5% Alc. By Vol. (75 Proof)')
      expect(f!.confidence).toBeGreaterThanOrEqual(75)
    })

    it('fails to find net_contents (OCR drops leading digit and trailing L)', () => {
      // OCR produces "00m" instead of "100 mL" — 50% character loss, unrecoverable
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds qualifying_phrase "Canned by"', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Canned by')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds name_and_address', () => {
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Bulleit Cocktail Co., New York, NY')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds class_type "Bourbon Whiskey" via fuzzy sliding window', () => {
      // OCR reads "BOUREON WHISKEY" — fuzzy match handles the typo
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Bourbon Whiskey')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds health_warning via fuzzy sliding window', () => {
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AI-generated labels
// ─────────────────────────────────────────────────────────────────────────────

describe('Submission pipeline — AI-generated labels', () => {
  describe('Blue Harbor Classic Lager (malt beverage)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(join(AI_DIR, 'blue-harbor-lager.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(20)

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'malt_beverage',
        {
          brand_name: 'Blue Harbor Brewing Co.',
          fanciful_name: 'Classic Lager',
          class_type: 'Lager',
          alcohol_content: 'Alc. 5.2% By Vol.',
          net_contents: '12 FL. OZ (355 ML)',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address: 'Blue Harbor Brewing Co.',
          qualifying_phrase: 'Brewed and Packaged by',
          country_of_origin: 'Product of USA',
        },
      )

      fields = result.fields
    }, 30_000)

    it('finds fanciful_name "Classic Lager"', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Classic Lager')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type "Lager"', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Lager')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Alc. 5.2% By Vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds qualifying_phrase via ampersand normalization', () => {
      // Label says "BREWED & PACKAGED BY", normalized to "Brewed and Packaged by"
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Brewed and Packaged by')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds brand_name via fuzzy sliding window', () => {
      // OCR garbles "Blue Harbor Brewing Co." — fuzzy match handles it
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Blue Harbor Brewing Co.')
      expect(f!.confidence).toBeGreaterThanOrEqual(85)
    })

    it('finds net_contents via punctuation-stripped match', () => {
      // OCR reads "12 FL. OZ. (355 ML)" with extra period — punctuation strip handles it
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('12 FL. OZ (355 ML)')
      expect(f!.confidence).toBeGreaterThanOrEqual(85)
    })
  })

  describe('Hacienda Sol Tequila Blanco (spirits, Mexican import)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(join(AI_DIR, 'hacienda-sol-tequila.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(20)

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        {
          brand_name: 'Hacienda Sol',
          class_type: 'Tequila Blanco',
          alcohol_content: '38% Alc./Vol.',
          net_contents: '750 ML',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address: 'Inejar Fruits Co, San Diego, CA',
          qualifying_phrase: 'Produced by',
          country_of_origin: 'Hecho en Mexico',
        },
      )

      fields = result.fields
    }, 30_000)

    it('finds brand_name "Hacienda Sol"', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Hacienda Sol')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type "Tequila Blanco"', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Tequila Blanco')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('38% Alc./Vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds country_of_origin "Hecho en Mexico"', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Hecho en Mexico')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('fails to find qualifying_phrase (OCR reads "PRODCTTED")', () => {
      // OCR garbles "PRODUCED" → "PRODCTTED"
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds name_and_address via fuzzy sliding window', () => {
      // OCR garbles producer info — fuzzy match handles it
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Inejar Fruits Co, San Diego, CA')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Dogwood Tennessee Whiskey (spirits, state-specific)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(join(AI_DIR, 'dogwood-tennessee-whiskey.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(20)

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        {
          brand_name: 'Dogwood Distilling',
          class_type: 'Tennessee Whiskey',
          alcohol_content: '46% Alc./Vol. (92 Proof)',
          net_contents: '750 ML',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address: 'Dogwood Distilling, Lynchburg, TN',
          qualifying_phrase: 'Distilled and Bottled by',
          country_of_origin: 'Made in USA',
        },
      )

      fields = result.fields
    }, 30_000)

    it('finds brand_name "Dogwood Distilling"', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Dogwood Distilling')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type "Tennessee Whiskey"', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Tennessee Whiskey')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content with proof', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('46% Alc./Vol. (92 Proof)')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds qualifying_phrase via ampersand normalization', () => {
      // Label says "DISTILLED & BOTTLED BY", matched as "Distilled and Bottled by"
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Distilled and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('fails to find country_of_origin (OCR reads "LINCIBURG TN USA")', () => {
      // "Made in USA" doesn't match — OCR only has "LINCIBURG TN USA"
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('finds name_and_address via fuzzy sliding window', () => {
      // OCR garbles distillery name — fuzzy match handles it
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Dogwood Distilling, Lynchburg, TN')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Vine Haven Chardonnay (wine, Australian import)', () => {
    let fields: Fields

    it('runs OCR and classification', async () => {
      const img = readFileSync(join(AI_DIR, 'vine-haven-chardonnay.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(20)

      const { result } = await classifyFieldsForSubmission(fullText, 'wine', {
        brand_name: 'Vine Haven',
        class_type: 'Chardonnay',
        alcohol_content: 'Alc. 12.5% By Vol.',
        net_contents: '750 ML',
        health_warning:
          'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        name_and_address: 'Vinewein Wines, South Australia',
        qualifying_phrase: 'Produced and Bottled by',
        grape_varietal: 'Chardonnay',
        appellation_of_origin: 'Coonawarra',
        country_of_origin: 'Product of Australia',
      })

      fields = result.fields
    }, 30_000)

    it('finds brand_name "Vine Haven"', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Vine Haven')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type "Chardonnay"', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Chardonnay')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Alc. 12.5% By Vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds grape_varietal "Chardonnay"', () => {
      const f = getField(fields, 'grape_varietal')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Chardonnay')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds appellation_of_origin "Coonawarra"', () => {
      const f = getField(fields, 'appellation_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Coonawarra')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds country_of_origin "Product of Australia"', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Product of Australia')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds qualifying_phrase via fuzzy ampersand-normalized match', () => {
      // OCR reads "DUCED & BOTTLED BY" — missing "PRO" prefix, fuzzy match handles it
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Produced and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds name_and_address via fuzzy sliding window', () => {
      // OCR garbles producer — fuzzy match handles it
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Vinewein Wines, South Australia')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })
})
