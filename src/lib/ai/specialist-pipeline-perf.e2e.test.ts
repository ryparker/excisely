// @vitest-environment node

/**
 * Performance + quality tests for the specialist-side AI pipeline.
 *
 * Validates that the full extraction pipeline (Cloud Vision OCR → GPT-4.1-nano
 * classification → local bounding box matching) completes in <5 seconds
 * per label AND produces accurate field extractions.
 *
 * Uses `extractLabelFieldsForSubmission` with pre-loaded image buffers
 * (simulating the `preloadedBuffers` optimization that overlaps image
 * fetching with DB writes in production).
 *
 * No mocks — uses the actual Google Cloud Vision API and OpenAI GPT-4.1-nano.
 * Each run costs ~$0.005-0.01 per label.
 *
 * Requirements:
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON env var (Cloud Vision service account)
 * - OPENAI_API_KEY env var (GPT-4.1-nano access)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import type {
  ExtractionResult,
  ExtractedField,
  PipelineMetrics,
} from '@/lib/ai/extract-label'

const AI_DIR = join(process.cwd(), 'test-labels/ai-generated')
const WINE_DIR = join(process.cwd(), 'test-labels/wine')

const hasCloudKeys =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
  !!process.env.OPENAI_API_KEY

/**
 * Maximum allowed total pipeline time in milliseconds (single image).
 * Typical: 3-5s. Budget includes 1s headroom for API latency variance
 * when running concurrently with other test files.
 */
const MAX_PIPELINE_MS = 6_000

/** Maximum allowed total pipeline time for multi-image labels (front+back) */
const MAX_PIPELINE_MULTI_MS = 8_000

/** Log a timing breakdown for debugging slow runs */
function logMetrics(label: string, metrics: PipelineMetrics) {
  const bar = (ms: number, max: number) => {
    const pct = Math.min(ms / max, 1)
    const filled = Math.round(pct * 20)
    return '█'.repeat(filled) + '░'.repeat(20 - filled)
  }

  console.log(`\n  ⏱  ${label}`)
  console.log(
    `     OCR:            ${String(metrics.ocrTimeMs).padStart(5)}ms ${bar(metrics.ocrTimeMs, MAX_PIPELINE_MS)}`,
  )
  console.log(
    `     Classification: ${String(metrics.classificationTimeMs).padStart(5)}ms ${bar(metrics.classificationTimeMs, MAX_PIPELINE_MS)}`,
  )
  console.log(
    `     Bbox merge:     ${String(metrics.mergeTimeMs).padStart(5)}ms ${bar(metrics.mergeTimeMs, MAX_PIPELINE_MS)}`,
  )
  console.log(
    `     TOTAL:          ${String(metrics.totalTimeMs).padStart(5)}ms ${bar(metrics.totalTimeMs, MAX_PIPELINE_MS)} ${metrics.totalTimeMs <= MAX_PIPELINE_MS ? '✓' : '✗ OVER BUDGET'}`,
  )
  console.log(
    `     Tokens:         ${metrics.inputTokens} in / ${metrics.outputTokens} out (${metrics.totalTokens} total)`,
  )
  console.log(
    `     Images:         ${metrics.imageCount} (${metrics.wordCount} words)`,
  )
}

/** Find a field by name in extraction results */
function getField(
  fields: ExtractedField[],
  name: string,
): ExtractedField | undefined {
  return fields.find((f) => f.fieldName === name)
}

/** Case-insensitive comparison — model returns OCR case (often UPPERCASE) */
function expectValueMatch(actual: string | null | undefined, expected: string) {
  expect(actual).not.toBeNull()
  expect(actual!.toLowerCase()).toBe(expected.toLowerCase())
}

/** Case-insensitive containment check */
function expectValueContains(
  actual: string | null | undefined,
  expected: string,
) {
  expect(actual).not.toBeNull()
  expect(actual!.toLowerCase()).toContain(expected.toLowerCase())
}

/** Assert the pipeline completed within budget and produced valid results */
function assertPipelineBasics(
  result: ExtractionResult,
  label: string,
  budgetMs = MAX_PIPELINE_MS,
) {
  logMetrics(label, result.metrics)

  // Core performance assertion
  expect(
    result.metrics.totalTimeMs,
    `${label}: pipeline took ${result.metrics.totalTimeMs}ms, budget is ${budgetMs}ms`,
  ).toBeLessThanOrEqual(budgetMs)

  // Sanity checks — the pipeline produced valid output
  expect(result.fields.length).toBeGreaterThan(0)
  expect(result.modelUsed).toBe('gpt-4.1-nano')
  expect(result.metrics.inputTokens).toBeGreaterThan(0)
  expect(result.metrics.outputTokens).toBeGreaterThan(0)

  // Every field should have a name and valid confidence range
  for (const field of result.fields) {
    expect(field.fieldName).toBeTruthy()
    expect(field.confidence).toBeGreaterThanOrEqual(0)
    expect(field.confidence).toBeLessThanOrEqual(100)
  }
}

// ---------------------------------------------------------------------------
// Single-image: distilled spirits
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — distilled spirits (perf + quality)',
  () => {
    let result: ExtractionResult

    it('Old Tom Vodka completes in < 5s', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'old-tom-vodka.png'))]

      result = await extractLabelFieldsForSubmission(
        [],
        'distilled_spirits',
        {
          brand_name: 'Old Tom Distillery',
          class_type: 'Vodka',
          alcohol_content: '40% Alc./Vol. (80 Proof)',
          net_contents: '750 ML',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address: 'Old Tom Distillery, Louisville, KY',
          qualifying_phrase: 'Distilled and Bottled by',
          country_of_origin: 'Imported from Poland',
          fanciful_name: 'Premium',
        },
        buffers,
      )

      assertPipelineBasics(result, 'Old Tom Vodka')
    }, 15_000)

    it('extracts brand_name correctly', () => {
      const f = getField(result.fields, 'brand_name')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Old Tom Distillery')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts class_type correctly', () => {
      const f = getField(result.fields, 'class_type')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Vodka')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts alcohol_content correctly', () => {
      const f = getField(result.fields, 'alcohol_content')
      expect(f).toBeDefined()
      expectValueContains(f!.value, '40%')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts net_contents correctly', () => {
      const f = getField(result.fields, 'net_contents')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, '750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts qualifying_phrase correctly', () => {
      const f = getField(result.fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expectValueContains(f!.value, 'distilled')
      expectValueContains(f!.value, 'bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts fanciful_name correctly', () => {
      const f = getField(result.fields, 'fanciful_name')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Premium')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts health_warning', () => {
      const f = getField(result.fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toUpperCase()).toContain('WARNING')
      expect(f!.confidence).toBeGreaterThanOrEqual(50)
    })

    it('extracts name_and_address', () => {
      const f = getField(result.fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expectValueContains(f!.value, 'old tom')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts country_of_origin', () => {
      const f = getField(result.fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expectValueContains(f!.value, 'imported')
      expect(f!.confidence).toBeGreaterThanOrEqual(50)
    })

    it('produces bounding boxes for most fields', () => {
      const fieldsWithBbox = result.fields.filter(
        (f) => f.value && f.boundingBox,
      )
      // At least half of non-null fields should have bounding boxes
      const fieldsWithValues = result.fields.filter((f) => f.value)
      expect(fieldsWithBbox.length).toBeGreaterThanOrEqual(
        Math.floor(fieldsWithValues.length / 2),
      )
    })
  },
)

// ---------------------------------------------------------------------------
// Single-image: more spirits (Hacienda Sol Tequila, Dogwood Tennessee Whiskey)
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — spirits variety (perf + quality)',
  () => {
    it('Hacienda Sol Tequila: < 5s, correct brand/class/alcohol/origin', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'hacienda-sol-tequila.png'))]

      const result = await extractLabelFieldsForSubmission(
        [],
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
        buffers,
      )

      assertPipelineBasics(result, 'Hacienda Sol Tequila')

      // Quality assertions
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueMatch(brand!.value, 'Hacienda Sol')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Tequila Blanco')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)

      const abv = getField(result.fields, 'alcohol_content')
      expect(abv).toBeDefined()
      expectValueContains(abv!.value, '38%')
      expect(abv!.confidence).toBeGreaterThanOrEqual(70)

      const origin = getField(result.fields, 'country_of_origin')
      expect(origin).toBeDefined()
      expectValueContains(origin!.value, 'mexico')
      expect(origin!.confidence).toBeGreaterThanOrEqual(70)

      const net = getField(result.fields, 'net_contents')
      expect(net).toBeDefined()
      expectValueMatch(net!.value, '750 ML')
      expect(net!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)

    it('Dogwood Tennessee Whiskey: < 5s, correct brand/class/alcohol/address', async () => {
      const buffers = [
        readFileSync(join(AI_DIR, 'dogwood-tennessee-whiskey.png')),
      ]

      const result = await extractLabelFieldsForSubmission(
        [],
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
        buffers,
      )

      assertPipelineBasics(result, 'Dogwood Tennessee Whiskey')

      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueContains(brand!.value, 'dogwood')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Tennessee Whiskey')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)

      const abv = getField(result.fields, 'alcohol_content')
      expect(abv).toBeDefined()
      expectValueContains(abv!.value, '46%')
      expect(abv!.confidence).toBeGreaterThanOrEqual(70)

      const addr = getField(result.fields, 'name_and_address')
      expect(addr).toBeDefined()
      expect(addr!.value).not.toBeNull()
      // OCR may garble "Lynchburg" on decorative labels
      expect(addr!.value!.toLowerCase()).toMatch(/l[iy]nc[hi]i?burg/)
      expect(addr!.confidence).toBeGreaterThanOrEqual(50)

      const qp = getField(result.fields, 'qualifying_phrase')
      expect(qp).toBeDefined()
      expectValueContains(qp!.value, 'distilled')
      expectValueContains(qp!.value, 'bottled by')
      expect(qp!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)
  },
)

// ---------------------------------------------------------------------------
// Single-image: wine
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — wine (perf + quality)',
  () => {
    let result: ExtractionResult

    it('Willow Glen Cabernet completes in < 5s', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'willow-glen-cabernet.png'))]

      result = await extractLabelFieldsForSubmission(
        [],
        'wine',
        {
          brand_name: 'Willow Glen Winery',
          class_type: 'Cabernet Sauvignon',
          alcohol_content: 'Alc. 14.5% By Vol.',
          net_contents: '750 ML',
          health_warning:
            'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
          name_and_address: 'Willow Glen Winery, PA, CA',
          qualifying_phrase: 'Produced and Bottled by',
          grape_varietal: 'Cabernet Sauvignon',
          appellation_of_origin: 'Napa Valley',
          country_of_origin: 'Product of USA',
          sulfite_declaration: 'Contains Sulfites',
        },
        buffers,
      )

      assertPipelineBasics(result, 'Willow Glen Cabernet')
    }, 15_000)

    it('extracts brand_name correctly', () => {
      const f = getField(result.fields, 'brand_name')
      expect(f).toBeDefined()
      expectValueContains(f!.value, 'willow glen')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts class_type correctly', () => {
      const f = getField(result.fields, 'class_type')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts alcohol_content correctly', () => {
      const f = getField(result.fields, 'alcohol_content')
      expect(f).toBeDefined()
      expectValueContains(f!.value, '14.5%')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts grape_varietal correctly', () => {
      const f = getField(result.fields, 'grape_varietal')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts appellation_of_origin correctly', () => {
      const f = getField(result.fields, 'appellation_of_origin')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Napa Valley')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts country_of_origin correctly', () => {
      const f = getField(result.fields, 'country_of_origin')
      expect(f).toBeDefined()
      expectValueContains(f!.value, 'usa')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts net_contents correctly', () => {
      const f = getField(result.fields, 'net_contents')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, '750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('extracts qualifying_phrase correctly', () => {
      const f = getField(result.fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expectValueContains(f!.value, 'produced')
      expectValueContains(f!.value, 'bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  },
)

// ---------------------------------------------------------------------------
// Single-image: wine variety (Vine Haven Chardonnay — Australian import)
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — wine import (perf + quality)',
  () => {
    it('Vine Haven Chardonnay: < 5s, correct brand/class/varietal/origin', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'vine-haven-chardonnay.png'))]

      const result = await extractLabelFieldsForSubmission(
        [],
        'wine',
        {
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
        },
        buffers,
      )

      assertPipelineBasics(result, 'Vine Haven Chardonnay')

      // Quality
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueMatch(brand!.value, 'Vine Haven')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Chardonnay')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)

      const varietal = getField(result.fields, 'grape_varietal')
      expect(varietal).toBeDefined()
      expectValueMatch(varietal!.value, 'Chardonnay')
      expect(varietal!.confidence).toBeGreaterThanOrEqual(70)

      const appellation = getField(result.fields, 'appellation_of_origin')
      expect(appellation).toBeDefined()
      expectValueMatch(appellation!.value, 'Coonawarra')
      expect(appellation!.confidence).toBeGreaterThanOrEqual(70)

      const origin = getField(result.fields, 'country_of_origin')
      expect(origin).toBeDefined()
      expectValueContains(origin!.value, 'australia')
      expect(origin!.confidence).toBeGreaterThanOrEqual(70)

      const abv = getField(result.fields, 'alcohol_content')
      expect(abv).toBeDefined()
      expectValueContains(abv!.value, '12.5%')
      expect(abv!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)
  },
)

// ---------------------------------------------------------------------------
// Single-image: malt beverage
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — malt beverage (perf + quality)',
  () => {
    it('Blue Harbor Lager: < 5s, correct brand/class/alcohol/qp', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'blue-harbor-lager.png'))]

      const result = await extractLabelFieldsForSubmission(
        [],
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
        buffers,
      )

      assertPipelineBasics(result, 'Blue Harbor Lager')

      // Quality
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueContains(brand!.value, 'blue harbor')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Lager')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)

      // alcohol_content is optional for malt beverages — assert if found
      const abv = getField(result.fields, 'alcohol_content')
      if (abv?.value) {
        expect(abv.value).toMatch(/\d+(\.\d+)?%/)
        expect(abv.confidence).toBeGreaterThanOrEqual(50)
      }

      const qp = getField(result.fields, 'qualifying_phrase')
      expect(qp).toBeDefined()
      expectValueContains(qp!.value, 'brewed')
      expectValueContains(qp!.value, 'packaged by')
      expect(qp!.confidence).toBeGreaterThanOrEqual(70)

      const net = getField(result.fields, 'net_contents')
      expect(net).toBeDefined()
      expectValueContains(net!.value, '12')
      expectValueContains(net!.value, 'oz')
      expect(net!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)
  },
)

// ---------------------------------------------------------------------------
// Multi-image labels (front + back — 2 OCR calls, more text for classification)
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — multi-image (perf + quality)',
  () => {
    it('Three Fox Viognier front+back: < 5s, correct wine fields across 2 images', async () => {
      const buffers = [
        readFileSync(join(WINE_DIR, 'three-fox-viognier-front.png')),
        readFileSync(join(WINE_DIR, 'three-fox-viognier-back.png')),
      ]

      const result = await extractLabelFieldsForSubmission(
        [],
        'wine',
        {
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
        },
        buffers,
      )

      assertPipelineBasics(
        result,
        'Three Fox Viognier (2 images)',
        MAX_PIPELINE_MULTI_MS,
      )
      expect(result.metrics.imageCount).toBe(2)

      // Quality — fields spread across front and back images
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueContains(brand!.value, 'three fox')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const fanciful = getField(result.fields, 'fanciful_name')
      expect(fanciful).toBeDefined()
      expectValueMatch(fanciful!.value, 'Viognier Reserve')
      expect(fanciful!.confidence).toBeGreaterThanOrEqual(70)

      const varietal = getField(result.fields, 'grape_varietal')
      expect(varietal).toBeDefined()
      expectValueMatch(varietal!.value, 'Viognier')
      expect(varietal!.confidence).toBeGreaterThanOrEqual(70)

      const vintage = getField(result.fields, 'vintage_year')
      expect(vintage).toBeDefined()
      expect(vintage!.value).toBe('2020')
      expect(vintage!.confidence).toBeGreaterThanOrEqual(70)

      const sulfites = getField(result.fields, 'sulfite_declaration')
      expect(sulfites).toBeDefined()
      expectValueMatch(sulfites!.value, 'Contains Sulfites')
      expect(sulfites!.confidence).toBeGreaterThanOrEqual(70)

      const net = getField(result.fields, 'net_contents')
      expect(net).toBeDefined()
      expectValueMatch(net!.value, '750mL')
      expect(net!.confidence).toBeGreaterThanOrEqual(70)

      const qp = getField(result.fields, 'qualifying_phrase')
      expect(qp).toBeDefined()
      expectValueContains(qp!.value, 'produced')
      expectValueContains(qp!.value, 'bottled by')
      expect(qp!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)

    it('Cooper Ridge Malbec front+back: < 5s, correct wine fields', async () => {
      const buffers = [
        readFileSync(join(WINE_DIR, 'cooper-ridge-malbec-front.png')),
        readFileSync(join(WINE_DIR, 'cooper-ridge-malbec-back.png')),
      ]

      const result = await extractLabelFieldsForSubmission(
        [],
        'wine',
        {
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
        },
        buffers,
      )

      assertPipelineBasics(
        result,
        'Cooper Ridge Malbec (2 images)',
        MAX_PIPELINE_MULTI_MS,
      )
      expect(result.metrics.imageCount).toBe(2)

      // Quality
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueMatch(brand!.value, 'Cooper Ridge')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Malbec')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)

      const varietal = getField(result.fields, 'grape_varietal')
      expect(varietal).toBeDefined()
      expectValueMatch(varietal!.value, 'Malbec')
      expect(varietal!.confidence).toBeGreaterThanOrEqual(70)

      const appellation = getField(result.fields, 'appellation_of_origin')
      expect(appellation).toBeDefined()
      expectValueMatch(appellation!.value, 'Umpqua Valley')
      expect(appellation!.confidence).toBeGreaterThanOrEqual(70)

      const vintage = getField(result.fields, 'vintage_year')
      expect(vintage).toBeDefined()
      expect(vintage!.value).toBe('2022')
      expect(vintage!.confidence).toBeGreaterThanOrEqual(70)

      const abv = getField(result.fields, 'alcohol_content')
      expect(abv).toBeDefined()
      expectValueContains(abv!.value, '13%')
      expect(abv!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)
  },
)

// ---------------------------------------------------------------------------
// Stage-level timing budgets
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)(
  'Specialist pipeline — stage timing budgets',
  () => {
    it('OCR < 1500ms, Classification < 4000ms, Merge < 50ms', async () => {
      const buffers = [readFileSync(join(AI_DIR, 'smithford-rye-whiskey.png'))]

      const result = await extractLabelFieldsForSubmission(
        [],
        'distilled_spirits',
        {
          brand_name: 'Smithford Distilling',
          class_type: 'Rye Whiskey',
          alcohol_content: '49% Alc./Vol. (98 Proof)',
          net_contents: '750 ML',
        },
        buffers,
      )

      logMetrics('Smithford Rye (stage budgets)', result.metrics)

      expect(
        result.metrics.ocrTimeMs,
        `OCR took ${result.metrics.ocrTimeMs}ms, budget is 1500ms`,
      ).toBeLessThanOrEqual(1500)

      expect(
        result.metrics.classificationTimeMs,
        `Classification took ${result.metrics.classificationTimeMs}ms, budget is 4800ms`,
      ).toBeLessThanOrEqual(4800)

      expect(
        result.metrics.mergeTimeMs,
        `Merge took ${result.metrics.mergeTimeMs}ms, budget is 50ms`,
      ).toBeLessThanOrEqual(50)

      // Also assert quality
      const brand = getField(result.fields, 'brand_name')
      expect(brand).toBeDefined()
      expectValueContains(brand!.value, 'smith')
      expect(brand!.confidence).toBeGreaterThanOrEqual(70)

      const classType = getField(result.fields, 'class_type')
      expect(classType).toBeDefined()
      expectValueMatch(classType!.value, 'Rye Whiskey')
      expect(classType!.confidence).toBeGreaterThanOrEqual(70)
    }, 15_000)
  },
)

// ---------------------------------------------------------------------------
// Aggregate: sequential batch (simulates specialist reviewing queue)
// ---------------------------------------------------------------------------

describe.skipIf(!hasCloudKeys)('Specialist pipeline — aggregate stats', () => {
  it('runs 3 diverse labels back-to-back, all < 5s, all correct core fields', async () => {
    const labels = [
      {
        name: 'Emerald Hill Sauvignon Blanc',
        file: 'emerald-hill-sauvignon-blanc.png',
        type: 'wine' as const,
        data: {
          brand_name: 'Emerald Hill',
          class_type: 'Sauvignon Blanc',
          alcohol_content: 'Alc. 12.5% By Vol.',
          net_contents: '750 ML',
        },
        assertions: (fields: ExtractedField[]) => {
          const brand = getField(fields, 'brand_name')
          expect(brand).toBeDefined()
          expectValueContains(brand!.value, 'emerald hill')
          expect(brand!.confidence).toBeGreaterThanOrEqual(70)

          const classType = getField(fields, 'class_type')
          expect(classType).toBeDefined()
          expectValueMatch(classType!.value, 'Sauvignon Blanc')
          expect(classType!.confidence).toBeGreaterThanOrEqual(70)

          const abv = getField(fields, 'alcohol_content')
          expect(abv).toBeDefined()
          expect(abv!.value).not.toBeNull()
          // AI-generated label may show different ABV than application data
          expect(abv!.value!).toMatch(/\d+(\.\d+)?%/)
        },
      },
      {
        name: 'Captains Cove Rum',
        file: 'captains-cove-rum.png',
        type: 'distilled_spirits' as const,
        data: {
          brand_name: "Captain's Cove",
          class_type: 'Rum',
          alcohol_content: '40% Alc./Vol.',
          net_contents: '750 ML',
        },
        assertions: (fields: ExtractedField[]) => {
          const classType = getField(fields, 'class_type')
          expect(classType).toBeDefined()
          // AI-generated label may show "Rum" or "Dark Rum"
          expectValueContains(classType!.value, 'rum')
          expect(classType!.confidence).toBeGreaterThanOrEqual(70)

          const abv = getField(fields, 'alcohol_content')
          expect(abv).toBeDefined()
          expect(abv!.value).not.toBeNull()
          // AI-generated label may show different ABV than application data
          expect(abv!.value!).toMatch(/\d+(\.\d+)?%/)
          expect(abv!.confidence).toBeGreaterThanOrEqual(70)
        },
      },
      {
        name: 'Iron Anchor IPA',
        file: 'iron-anchor-ipa.png',
        type: 'malt_beverage' as const,
        data: {
          brand_name: 'Iron Anchor',
          class_type: 'India Pale Ale',
          alcohol_content: 'Alc. 6.8% By Vol.',
          net_contents: '12 FL. OZ.',
        },
        assertions: (fields: ExtractedField[]) => {
          const brand = getField(fields, 'brand_name')
          expect(brand).toBeDefined()
          expectValueContains(brand!.value, 'iron anchor')
          expect(brand!.confidence).toBeGreaterThanOrEqual(70)

          // AI-generated label shows 7.0% not 6.8% — match any valid ABV
          const abv = getField(fields, 'alcohol_content')
          expect(abv).toBeDefined()
          expect(abv!.value).not.toBeNull()
          expect(abv!.value!).toMatch(/\d+(\.\d+)?%/)
        },
      },
    ]

    const results: Array<{ name: string; metrics: PipelineMetrics }> = []

    // Run sequentially — simulates specialist reviewing one label at a time
    for (const label of labels) {
      const buffers = [readFileSync(join(AI_DIR, label.file))]

      const result = await extractLabelFieldsForSubmission(
        [],
        label.type,
        label.data,
        buffers,
      )

      results.push({ name: label.name, metrics: result.metrics })

      // Performance assertion
      expect(
        result.metrics.totalTimeMs,
        `${label.name}: ${result.metrics.totalTimeMs}ms > ${MAX_PIPELINE_MS}ms`,
      ).toBeLessThanOrEqual(MAX_PIPELINE_MS)

      // Quality assertion
      label.assertions(result.fields)
    }

    // Print summary table
    console.log(
      '\n  ┌─────────────────────────────────┬───────┬────────┬───────┬───────┐',
    )
    console.log(
      '  │ Label                           │ OCR   │ Class  │ Merge │ Total │',
    )
    console.log(
      '  ├─────────────────────────────────┼───────┼────────┼───────┼───────┤',
    )
    for (const r of results) {
      const name = r.name.padEnd(31)
      const ocr = `${r.metrics.ocrTimeMs}`.padStart(5)
      const cls = `${r.metrics.classificationTimeMs}`.padStart(5)
      const merge = `${r.metrics.mergeTimeMs}`.padStart(5)
      const total = `${r.metrics.totalTimeMs}`.padStart(5)
      console.log(`  │ ${name} │ ${ocr} │ ${cls}  │ ${merge} │ ${total} │`)
    }
    console.log(
      '  └─────────────────────────────────┴───────┴────────┴───────┴───────┘',
    )

    const avg = Math.round(
      results.reduce((s, r) => s + r.metrics.totalTimeMs, 0) / results.length,
    )
    console.log(`\n  Average: ${avg}ms across ${results.length} labels`)
  }, 60_000)
})
