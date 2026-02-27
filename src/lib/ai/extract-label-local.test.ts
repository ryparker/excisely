// @vitest-environment node

/**
 * Comprehensive pipeline tests — local (Tesseract) and cloud (Cloud Vision + GPT-4.1 Nano).
 *
 * Tests every label image in test-labels/ against both pipelines.
 * Local pipeline: Tesseract OCR → text search → comparison (zero cloud calls).
 * Cloud pipeline: Google Cloud Vision OCR + GPT-4.1 Nano (requires API keys).
 *
 * Run: yarn vitest run src/lib/ai/extract-label-local.test.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractLabelFieldsLocal } from '@/lib/ai/extract-label'
import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LABELS_DIR = join(process.cwd(), 'test-labels')

type Fields = Array<{
  fieldName: string
  value: string | null
  confidence: number
  reasoning: string | null
}>

function getField(fields: Fields, name: string) {
  return fields.find((f) => f.fieldName === name)
}

function expectFieldMatch(
  fieldName: string,
  expected: string,
  extracted: string | null,
) {
  expect(extracted).not.toBeNull()
  const result = compareField(fieldName, expected, extracted)
  expect(result.status).toBe('match')
}

// ---------------------------------------------------------------------------
// Test label definitions
// ---------------------------------------------------------------------------

interface TestLabel {
  name: string
  dir: string
  images: string[]
  beverageType: BeverageType
  appData: Record<string, string>
  /** Fields the local pipeline cannot read (expect null) */
  localNotFound: string[]
  /** Fields the local pipeline garbles (expect wrong value, not null) */
  localMismatch: string[]
  /** Fields the cloud pipeline cannot read (expect null) */
  cloudNotFound: string[]
  /** Fields the cloud pipeline garbles (expect wrong value) */
  cloudMismatch: string[]
  /** Fields where cloud extraction is non-deterministic (skip assertion) */
  cloudUnstable?: string[]
}

const TEST_LABELS: TestLabel[] = [
  // =========================================================================
  // MALT BEVERAGES
  // =========================================================================
  {
    name: 'Blue Harbor Lager',
    dir: 'beer/blue-harbor-lager',
    images: ['front.png'],
    beverageType: 'malt_beverage',
    appData: {
      brand_name: 'Blue Harbor',
      class_type: 'Lager',
      alcohol_content: 'ALC. 5.2% BY VOL.',
      net_contents: '12 FL. OZ. (355 mL)',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Blue Harbor Brewing Co.',
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Mountain Ridge Pale Ale',
    dir: 'beer/mountain-ridge-pale-ale',
    images: ['front.png'],
    beverageType: 'malt_beverage',
    appData: {
      brand_name: 'Mountain Ridge',
      class_type: 'Pale Ale',
      alcohol_content: 'ALC. 5.6% BY VOL.',
      net_contents: '12 FL. OZ. (355ML)',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Mountain Ridge Brewing WI., Milwaukee, WI.',
      country_of_origin: 'Product of USA.',
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Sierra Nevada Stout',
    dir: 'beer/sierra-nevada',
    images: ['front.png'],
    beverageType: 'malt_beverage',
    appData: {
      brand_name: 'Sierra Nevada',
      fanciful_name: 'Trip Thru the Woods',
      class_type: 'Imperial Stout',
      alcohol_content: 'ALC. 13.8% BY VOL.',
      net_contents: '1 PT. 9.4 FL. OZ.',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address:
        'Sierra Nevada Brewing Co., Chico, CA & Mills River, NC',
    },
    localNotFound: ['fanciful_name', 'class_type', 'health_warning'],
    localMismatch: ['alcohol_content'],
    cloudNotFound: [],
    cloudMismatch: [],
    cloudUnstable: ['alcohol_content'],
  },
  {
    name: 'Twisted Tea Light',
    dir: 'beer/twisted-tea-light-lemon',
    images: ['front.png', 'top.png'],
    beverageType: 'malt_beverage',
    appData: {
      brand_name: 'Twisted Tea',
      fanciful_name: 'Light',
      class_type: 'Hard Iced Tea',
      alcohol_content: '4% ALC./VOL.',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: ['fanciful_name', 'health_warning'],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },

  // =========================================================================
  // DISTILLED SPIRITS
  // =========================================================================
  {
    name: 'Backbone Bourbon',
    dir: 'whiskey/backbone-bourbon',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Backbone Bourbon',
      fanciful_name: 'Estate',
      class_type: 'Straight Bourbon Whiskey',
      alcohol_content: '57% ALC/VOL',
      net_contents: '750ML',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Barclay & Sons Scotch',
    dir: 'whiskey/barclay-sons-scotch',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Barclay & Sons',
      class_type: 'Scotch Whisky',
      alcohol_content: '43% Alc./Vol.',
      net_contents: '750 ML',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Barclay & Sons Distillery, Edinburgh, Scotland',
      qualifying_phrase: 'Distilled and Bottled by',
      country_of_origin: 'Product of Scotland',
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Hacienda Sol Tequila Blanco',
    dir: 'ai-generated/hacienda-sol-tequila',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Hacienda Sol',
      class_type: 'Tequila Blanco',
      alcohol_content: '38% Alc./Vol.',
      net_contents: '750 ML',
      health_warning: HEALTH_WARNING_FULL,
      country_of_origin: 'Hecho en Mexico',
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Branch & Barrel Wheat',
    dir: 'whiskey/branch-barrel-wheat',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Branch & Barrel',
      class_type: 'Wheat Whiskey',
      alcohol_content: '46% Alc. by Vol.',
      net_contents: '750ml',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    // 650x161 — too narrow/short for Tesseract to read anything
    // NOTE: Directory is mislabeled. Image is actually Bulleit 95 Rye (same as bulleit-rye).
    name: 'Bulleit 95 Rye (bourbon-10yr dir)',
    dir: 'whiskey/bulleit-bourbon-10yr',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit 95 Rye',
      fanciful_name: 'Frontier Whiskey',
      class_type: 'American Straight Rye Whiskey',
      alcohol_content: '45% alc./vol.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [
      'brand_name',
      'fanciful_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'health_warning',
    ],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Bulleit Bourbon Frontier',
    dir: 'whiskey/bulleit-frontier',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit',
      fanciful_name: 'Frontier Whiskey',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '45% alc./vol.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: ['alcohol_content', 'health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Bulleit Old Fashioned',
    dir: 'whiskey/bulleit-old-fashioned',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit',
      fanciful_name: 'Old Fashioned',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '37.5% ALC BY VOL',
      net_contents: '100 mL',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    // 650x161 — too narrow/short for Tesseract
    name: 'Bulleit 95 Rye',
    dir: 'whiskey/bulleit-rye',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit 95 Rye',
      class_type: 'Frontier Whiskey',
      alcohol_content: '45% alc./vol.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [
      'brand_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'health_warning',
    ],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Bulleit Single Barrel',
    dir: 'whiskey/bulleit-single-barrel',
    images: ['front.png', 'neck.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit Bourbon',
      fanciful_name: 'Single Barrel',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '52% ALC BY VOL',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: ['alcohol_content', 'health_warning'],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Crafted Spirits Malinowka',
    dir: 'whiskey/crafted-spirits-malinowka',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Crafted Spirits by Arkadius',
      fanciful_name: 'Malinówka',
      class_type: 'Liqueur',
      alcohol_content: '30% ALC. BY VOL.',
      net_contents: '750 ML',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: ['fanciful_name', 'health_warning'],
    localMismatch: ['brand_name', 'alcohol_content'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Dashfire Old Fashioned',
    dir: 'whiskey/dashfire-old-fashioned',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Dashfire',
      fanciful_name: 'Old Fashioned',
      class_type: 'Bourbon Old Fashioned',
      alcohol_content: '38% Alc./Vol.',
      net_contents: '100 mL',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Dashfire, Minneapolis, Minnesota',
      qualifying_phrase: 'Produced by',
    },
    localNotFound: [
      'alcohol_content',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
    ],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    // Front: 650x286, Back: 227x152 (back label unreadable)
    name: 'Knob Creek Single Barrel Reserve',
    dir: 'whiskey/knob-creek-single-barrel',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Knob Creek',
      fanciful_name: 'Single Barrel Reserve',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '60% Alc./Vol.',
      net_contents: '750 ml',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'James B Beam Distilling Co., Clermont, Kentucky',
      qualifying_phrase: 'Distilled and Bottled by',
      age_statement: 'Aged Nine Years',
      state_of_distillation: 'Kentucky',
    },
    localNotFound: [
      'alcohol_content',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
      'age_statement',
    ],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    // Same images as above (duplicate set)
    name: 'Knob Creek (original images)',
    dir: 'whiskey/knob-creek',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Knob Creek',
      fanciful_name: 'Single Barrel Reserve',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '60% Alc./Vol.',
      net_contents: '750 ml',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'James B Beam Distilling Co., Clermont, Kentucky',
      qualifying_phrase: 'Distilled and Bottled by',
      age_statement: 'Aged Nine Years',
      state_of_distillation: 'Kentucky',
    },
    localNotFound: [
      'alcohol_content',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
      'age_statement',
    ],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },

  // =========================================================================
  // WINE
  // =========================================================================
  {
    name: 'Cooper Ridge Malbec',
    dir: 'wine/cooper-ridge-malbec',
    images: ['front.png', 'back.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Cooper Ridge',
      fanciful_name: 'Fox Hollow Vineyard',
      class_type: 'Malbec',
      alcohol_content: 'Alc. 13% by Vol.',
      net_contents: '750 ml',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Domaine de Montredon',
    dir: 'wine/domaine-montredon',
    images: ['front.png', 'back.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Domaine de Montredon',
      class_type: 'Carignan',
      alcohol_content: 'ALC. 13.5% BY VOL.',
      net_contents: '750 ML',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: ['class_type'],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Emerald Hill Sauvignon Blanc',
    dir: 'wine/emerald-hill-sauvignon-blanc',
    images: ['front.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Emerald Hill Vineyard',
      class_type: 'Sauvignon Blanc',
      alcohol_content: '13% BY VOL.',
      net_contents: '750 ML',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Emerald Hill Vineyard, Sonoma County, California',
      qualifying_phrase: 'Produced and Bottled by',
      country_of_origin: 'Product of USA',
      grape_varietal: 'Sauvignon Blanc',
      appellation_of_origin: 'Sonoma County',
    },
    localNotFound: [],
    localMismatch: ['health_warning'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Forever Summer Rose',
    dir: 'wine/forever-summer',
    images: ['front.png', 'back.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Forever Summer',
      class_type: 'Rose Wine',
      alcohol_content: 'ALC. 12.5% BY VOL.',
      net_contents: '750ML',
      health_warning: HEALTH_WARNING_FULL,
    },
    localNotFound: [],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Domaine Jourdan Croix Boissee',
    dir: 'wine/jourdan-croix-boissee',
    images: ['front.png', 'back.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Domaine Jourdan',
      fanciful_name: 'Croix Boissée',
      class_type: 'White Wine',
      alcohol_content: '13.5% by volume',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Domaine Jourdan 37500 Cravant',
      qualifying_phrase: 'Bottled by',
      country_of_origin: 'Product of France',
      grape_varietal: 'Chenin Blanc',
      appellation_of_origin: 'Chinon',
    },
    localNotFound: ['alcohol_content', 'net_contents', 'qualifying_phrase'],
    localMismatch: ['name_and_address'],
    cloudNotFound: [],
    cloudMismatch: [],
  },
  {
    name: 'Three Fox Viognier',
    dir: 'wine/three-fox-viognier',
    images: ['front.png', 'back.png'],
    beverageType: 'wine',
    appData: {
      brand_name: 'Three Fox Vineyards',
      class_type: 'Table Wine',
      alcohol_content: '12.5% BY VOL',
      net_contents: '750ML',
      health_warning: HEALTH_WARNING_FULL,
      name_and_address: 'Three Fox Vineyards, Delaplane, VA',
      qualifying_phrase: 'Bottled by',
      grape_varietal: 'Viognier',
      appellation_of_origin: 'Virginia',
    },
    localNotFound: ['class_type', 'appellation_of_origin'],
    localMismatch: [],
    cloudNotFound: [],
    cloudMismatch: [],
  },
]

// ---------------------------------------------------------------------------
// LOCAL PIPELINE TESTS (Tesseract — no cloud calls)
// ---------------------------------------------------------------------------

for (const label of TEST_LABELS) {
  describe(`Local — ${label.name}`, () => {
    let fields: Fields

    it('extracts fields via Tesseract OCR', async () => {
      const buffers = label.images.map((img) =>
        readFileSync(join(LABELS_DIR, label.dir, img)),
      )

      const result = await extractLabelFieldsLocal(
        [],
        label.beverageType,
        label.appData,
        buffers,
      )

      expect(result.modelUsed).toBe('tesseract-local')
      expect(result.metrics.inputTokens).toBe(0)
      expect(result.fields.length).toBe(Object.keys(label.appData).length)
      fields = result.fields
    }, 60_000)

    for (const [fieldName, expectedValue] of Object.entries(label.appData)) {
      if (label.localNotFound.includes(fieldName)) {
        it(`${fieldName}: not found (image quality limitation)`, () => {
          const field = getField(fields, fieldName)
          expect(field).toBeDefined()
          expect(field?.value).toBeNull()
        })
      } else if (label.localMismatch.includes(fieldName)) {
        it(`${fieldName}: mismatch (OCR garbling)`, () => {
          const field = getField(fields, fieldName)
          expect(field).toBeDefined()
          // Field has a value, but it doesn't match due to OCR errors
          expect(field?.value).not.toBeNull()
          const result = compareField(
            fieldName,
            expectedValue,
            field?.value ?? null,
          )
          expect(result.status).not.toBe('match')
        })
      } else {
        it(`matches ${fieldName}`, () => {
          expectFieldMatch(
            fieldName,
            expectedValue,
            getField(fields, fieldName)?.value ?? null,
          )
        })
      }
    }
  })
}

// ---------------------------------------------------------------------------
// CLOUD PIPELINE TESTS (Cloud Vision + GPT-4.1 Nano)
// ---------------------------------------------------------------------------

const hasCloudKeys =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
  !!process.env.OPENAI_API_KEY

for (const label of TEST_LABELS) {
  describe.skipIf(!hasCloudKeys)(`Cloud — ${label.name}`, () => {
    let fields: Fields

    it('extracts fields via Cloud Vision + GPT-4.1 Nano', async () => {
      const buffers = label.images.map((img) =>
        readFileSync(join(LABELS_DIR, label.dir, img)),
      )

      const result = await extractLabelFieldsForSubmission(
        [],
        label.beverageType,
        label.appData,
        buffers,
      )

      expect(result.modelUsed).toBe('gpt-4.1-nano')
      expect(result.fields.length).toBeGreaterThan(0)
      fields = result.fields
    }, 30_000)

    for (const [fieldName, expectedValue] of Object.entries(label.appData)) {
      if (label.cloudUnstable?.includes(fieldName)) {
        it(`${fieldName}: unstable (non-deterministic LLM extraction)`, () => {
          const field = getField(fields, fieldName)
          // Accept match, null, or missing — LLM is non-deterministic for this field
          if (field?.value != null) {
            const result = compareField(fieldName, expectedValue, field.value)
            expect(result.status).toBe('match')
          }
        })
      } else if (label.cloudNotFound.includes(fieldName)) {
        it(`${fieldName}: not found (cloud pipeline limitation)`, () => {
          const field = getField(fields, fieldName)
          expect(field).toBeDefined()
          expect(field?.value).toBeNull()
        })
      } else if (label.cloudMismatch.includes(fieldName)) {
        it(`${fieldName}: mismatch (cloud extraction error)`, () => {
          const field = getField(fields, fieldName)
          expect(field).toBeDefined()
          expect(field?.value).not.toBeNull()
          const result = compareField(
            fieldName,
            expectedValue,
            field?.value ?? null,
          )
          expect(result.status).not.toBe('match')
        })
      } else {
        it(`matches ${fieldName}`, () => {
          expectFieldMatch(
            fieldName,
            expectedValue,
            getField(fields, fieldName)?.value ?? null,
          )
        })
      }
    }
  })
}
