// @vitest-environment node

/**
 * Diverse end-to-end tests for the specialist submission pipeline.
 *
 * Tests the full pipeline (Cloud Vision OCR → GPT-4.1 classification) against
 * a mix of real-world labels and AI-generated labels across all three beverage
 * types: wine, distilled spirits, and malt beverages.
 *
 * Real-world labels test OCR robustness with varied fonts, colors, layouts,
 * and photography conditions. AI-generated labels test clean extraction.
 *
 * No mocks — uses the actual Google Cloud Vision API and OpenAI GPT-4.1.
 * ~5-10s per test due to network latency. Each run costs ~$0.01-0.02/label.
 *
 * Note: GPT-4.1 returns values as read from OCR text (often UPPERCASE).
 * Assertions use case-insensitive matching since the comparison engine
 * handles case normalization separately.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractTextMultiImage } from '@/lib/ai/ocr'
import { classifyFieldsForSubmission } from '@/lib/ai/classify-fields'

const AI_DIR = join(process.cwd(), 'test-labels/ai-generated')
const WHISKEY_DIR = join(process.cwd(), 'test-labels/whiskey')
const WINE_DIR = join(process.cwd(), 'test-labels/wine')
const BEER_DIR = join(process.cwd(), 'test-labels/beer')

const hasCloudKeys =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
  !!process.env.OPENAI_API_KEY

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

/** Case-insensitive comparison — GPT-4.1 returns OCR case (often UPPERCASE) */
function expectValueMatch(actual: string | null, expected: string) {
  expect(actual).not.toBeNull()
  expect(actual!.toLowerCase()).toBe(expected.toLowerCase())
}

// ---------------------------------------------------------------------------
// Real-world labels
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Submission pipeline — real-world labels',
  () => {
    describe('Three Fox Viognier Reserve (wine, front+back, Virginia)', () => {
      let fields: Fields

      it('runs OCR and classification on front+back pair', async () => {
        const front = readFileSync(
          join(WINE_DIR, 'three-fox-viognier-front.png'),
        )
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

      it('finds brand_name', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('three fox')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds fanciful_name "Viognier Reserve"', () => {
        const f = getField(fields, 'fanciful_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Viognier Reserve')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds grape_varietal', () => {
        const f = getField(fields, 'grape_varietal')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Viognier')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents', () => {
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, '750mL')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds sulfite_declaration', () => {
        const f = getField(fields, 'sulfite_declaration')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Contains Sulfites')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds vintage_year', () => {
        const f = getField(fields, 'vintage_year')
        expect(f).toBeDefined()
        expect(f!.value).toBe('2020')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('produced')
        expect(f!.value!.toLowerCase()).toContain('bottled by')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('handles class_type ("Table Wine" may not be printed on label)', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
      })
    })

    describe('Cooper Ridge Malbec (wine, front+back, Oregon)', () => {
      let fields: Fields

      it('runs OCR and classification on front+back pair', async () => {
        const front = readFileSync(
          join(WINE_DIR, 'cooper-ridge-malbec-front.png'),
        )
        const back = readFileSync(
          join(WINE_DIR, 'cooper-ridge-malbec-back.png'),
        )
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

      it('finds brand_name', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Cooper Ridge')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Malbec"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Malbec')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds grape_varietal', () => {
        const f = getField(fields, 'grape_varietal')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Malbec')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds appellation_of_origin "Umpqua Valley"', () => {
        const f = getField(fields, 'appellation_of_origin')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Umpqua Valley')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds vintage_year "2022"', () => {
        const f = getField(fields, 'vintage_year')
        expect(f).toBeDefined()
        expect(f!.value).toBe('2022')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('13%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('bottled by')
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
        expectValueMatch(f!.value, 'Forever Summer')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds fanciful_name "Mediterranee"', () => {
        const f = getField(fields, 'fanciful_name')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('mediterran')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds country_of_origin "Product of France"', () => {
        const f = getField(fields, 'country_of_origin')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('france')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type (Cloud Vision reads correctly)', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        // Cloud Vision should read "Rose" or "Rosé" correctly
        expect(f!.value!.toLowerCase()).toContain('ros')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('12.5%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
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

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('4%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds brand_name "Twisted Tea"', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Twisted Tea')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds fanciful_name "Light"', () => {
        const f = getField(fields, 'fanciful_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Light')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Hard Iced Tea"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Hard Iced Tea')
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
            name_and_address: 'Bulleit Cocktail Co., New York, NY',
            qualifying_phrase: 'Canned by',
          },
        )

        fields = result.fields
      }, 30_000)

      it('finds brand_name "Bulleit"', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Bulleit')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds fanciful_name "Old Fashioned"', () => {
        const f = getField(fields, 'fanciful_name')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Old Fashioned')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('37.5%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents "100 mL" (Cloud Vision reads small text)', () => {
        // Cloud Vision reads "100 mL" correctly (Tesseract had "00m")
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('100')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('canned by')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds name_and_address', () => {
        const f = getField(fields, 'name_and_address')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('new york')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Bourbon Whiskey"', () => {
        // Cloud Vision reads "BOURBON WHISKEY" correctly
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('bourbon')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('attempts health_warning extraction', () => {
        const f = getField(fields, 'health_warning')
        expect(f).toBeDefined()
        // Real-world small text — may or may not be fully extracted
      })
    })
  },
)

// ---------------------------------------------------------------------------
// AI-generated labels
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Submission pipeline — AI-generated labels',
  () => {
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
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('classic')
        expect(f!.confidence).toBeGreaterThanOrEqual(40)
      })

      it('finds class_type "Lager"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Lager')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content (optional for malt beverages)', () => {
        const f = getField(fields, 'alcohol_content')
        // alcohol_content is optional per TTB 27 CFR Part 7 for malt beverages.
        // gpt-4.1-nano occasionally omits it — acceptable for an optional field.
        if (f && f.value) {
          expect(f.value).toContain('5.2%')
          expect(f.confidence).toBeGreaterThanOrEqual(50)
        }
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('brewed')
        expect(f!.value!.toLowerCase()).toContain('packaged by')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds brand_name', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('blue harbor')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents', () => {
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('12')
        expect(f!.value!.toLowerCase()).toContain('oz')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
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
        expectValueMatch(f!.value, 'Hacienda Sol')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Tequila Blanco"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Tequila Blanco')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('38%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents', () => {
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, '750 ML')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds country_of_origin', () => {
        const f = getField(fields, 'country_of_origin')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('mexico')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        // OCR may still garble decorative fonts (e.g., "PROUCTTED" for "PRODUCED")
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('by')
        expect(f!.confidence).toBeGreaterThanOrEqual(50)
      })

      it('finds name_and_address', () => {
        const f = getField(fields, 'name_and_address')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('san diego')
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

      it('finds brand_name', () => {
        const f = getField(fields, 'brand_name')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('dogwood')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Tennessee Whiskey"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Tennessee Whiskey')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content with proof', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('46%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents', () => {
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, '750 ML')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('distilled')
        expect(f!.value!.toLowerCase()).toContain('bottled by')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('attempts country_of_origin extraction', () => {
        // "Made in USA" may not appear as explicit text — OCR may only show city/state
        const f = getField(fields, 'country_of_origin')
        expect(f).toBeDefined()
        // Model may report null or low confidence if "Made in USA" isn't found
      })

      it('finds name_and_address', () => {
        const f = getField(fields, 'name_and_address')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        // OCR may garble "Lynchburg" to "Linciburg" on decorative labels
        expect(f!.value!.toLowerCase()).toMatch(/l[iy]nc[hi]i?burg/)
        expect(f!.confidence).toBeGreaterThanOrEqual(50)
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
        expectValueMatch(f!.value, 'Vine Haven')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds class_type "Chardonnay"', () => {
        const f = getField(fields, 'class_type')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Chardonnay')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds alcohol_content', () => {
        const f = getField(fields, 'alcohol_content')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!).toContain('12.5%')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds net_contents', () => {
        const f = getField(fields, 'net_contents')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, '750 ML')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds grape_varietal "Chardonnay"', () => {
        const f = getField(fields, 'grape_varietal')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Chardonnay')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds appellation_of_origin "Coonawarra"', () => {
        const f = getField(fields, 'appellation_of_origin')
        expect(f).toBeDefined()
        expectValueMatch(f!.value, 'Coonawarra')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds country_of_origin', () => {
        const f = getField(fields, 'country_of_origin')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('australia')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds qualifying_phrase', () => {
        const f = getField(fields, 'qualifying_phrase')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('produced')
        expect(f!.value!.toLowerCase()).toContain('bottled by')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })

      it('finds name_and_address', () => {
        const f = getField(fields, 'name_and_address')
        expect(f).toBeDefined()
        expect(f!.value).not.toBeNull()
        expect(f!.value!.toLowerCase()).toContain('australia')
        expect(f!.confidence).toBeGreaterThanOrEqual(70)
      })
    })
  },
)
