/**
 * Diagnostic script: tests the CLOUD pipeline (Google Cloud Vision OCR +
 * OpenAI GPT-4.1 Nano) against all organized test label images and reports
 * PASS/FAIL for each field.
 *
 * Requires env vars: GOOGLE_APPLICATION_CREDENTIALS_JSON, OPENAI_API_KEY
 *
 * Run: npx tsx scripts/diagnose-cloud-pipeline.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import fs from 'node:fs'
import path from 'node:path'

import { extractLabelFieldsForSubmission } from '@/lib/ai/extract-label'
import { compareField } from '@/lib/ai/compare-fields'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Health warning (full text per 27 CFR Part 16)
// ---------------------------------------------------------------------------

const HEALTH_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

// ---------------------------------------------------------------------------
// Test label definitions
// ---------------------------------------------------------------------------

interface TestLabel {
  name: string
  dir: string
  images: string[]
  beverageType: BeverageType
  appData: Record<string, string>
}

const TEST_LABELS: TestLabel[] = [
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Blue Harbor Brewing Co.',
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Mountain Ridge Brewing WI., Milwaukee, WI.',
      country_of_origin: 'Product of USA.',
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address:
        'Sierra Nevada Brewing Co., Chico, CA & Mills River, NC',
    },
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
      health_warning: HEALTH_WARNING,
    },
  },
  {
    name: 'Backbone Bourbon',
    dir: 'whiskey/backbone-bourbon',
    images: ['front.png', 'back.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Backbone Bourbon',
      fanciful_name: 'Estate',
      class_type: 'Straight Bourbon Whiskey',
      alcohol_content: '45% ALC/VOL',
      net_contents: '750ML',
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Barclay & Sons Distillery, Edinburgh, Scotland',
      qualifying_phrase: 'Distilled and Bottled by',
      country_of_origin: 'Product of Scotland',
    },
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
      health_warning: HEALTH_WARNING,
    },
  },
  {
    name: 'Bulleit Bourbon 10yr',
    dir: 'whiskey/bulleit-bourbon-10yr',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit Bourbon',
      fanciful_name: 'Double Barrel',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '45% ALC. BY VOL.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING,
    },
  },
  {
    name: 'Bulleit Frontier',
    dir: 'whiskey/bulleit-frontier',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit',
      fanciful_name: 'Frontier Whiskey',
      class_type: 'Tennessee Whiskey',
      alcohol_content: '45% alc./vol. 90 PROOF',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING,
    },
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
      alcohol_content: '40% ALC BY VOL',
      net_contents: '100 mL',
      health_warning: HEALTH_WARNING,
    },
  },
  {
    name: 'Bulleit 95 Rye',
    dir: 'whiskey/bulleit-rye',
    images: ['front.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit 95 Rye',
      class_type: 'Frontier Whiskey',
      alcohol_content: '45% alc./vol.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING,
    },
  },
  {
    name: 'Bulleit Single Barrel',
    dir: 'whiskey/bulleit-single-barrel',
    images: ['front.png', 'neck.png'],
    beverageType: 'distilled_spirits',
    appData: {
      brand_name: 'Bulleit Bourbon',
      fanciful_name: 'Double Barrel',
      class_type: 'Kentucky Straight Bourbon Whiskey',
      alcohol_content: '45% ALC. BY VOL.',
      net_contents: '750 mL',
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Dashfire, Minneapolis, Minnesota',
      qualifying_phrase: 'Produced by',
    },
  },
  {
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'James B Beam Distilling Co., Clermont, Kentucky',
      qualifying_phrase: 'Distilled and Bottled by',
      age_statement: 'Aged Nine Years',
      state_of_distillation: 'Kentucky',
    },
  },
  {
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'James B Beam Distilling Co., Clermont, Kentucky',
      qualifying_phrase: 'Distilled and Bottled by',
      age_statement: 'Aged Nine Years',
      state_of_distillation: 'Kentucky',
    },
  },
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
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Emerald Hill Vineyard, Sonoma County, California',
      qualifying_phrase: 'Produced and Bottled by',
      country_of_origin: 'Product of USA',
      grape_varietal: 'Sauvignon Blanc',
      appellation_of_origin: 'Sonoma County',
    },
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
      health_warning: HEALTH_WARNING,
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Domaine Jourdan 37500 Cravant',
      qualifying_phrase: 'Bottled by',
      country_of_origin: 'Product of France',
      grape_varietal: 'Chenin Blanc',
      appellation_of_origin: 'Chinon',
    },
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
      health_warning: HEALTH_WARNING,
      name_and_address: 'Three Fox Vineyards, Delaplane, VA',
      qualifying_phrase: 'Bottled by',
      grape_varietal: 'Viognier',
      appellation_of_origin: 'Virginia',
    },
  },
]

// ---------------------------------------------------------------------------
// Main diagnostic
// ---------------------------------------------------------------------------

const TEST_LABELS_DIR = path.resolve(__dirname, '..', 'test-labels')

interface FieldResult {
  label: string
  field: string
  status: 'PASS' | 'FAIL' | 'NOT_FOUND'
  extracted: string | null
  expected: string
  confidence: number
  reasoning: string
}

async function main() {
  console.log('='.repeat(80))
  console.log(
    '  CLOUD PIPELINE DIAGNOSTIC — Google Cloud Vision OCR + GPT-4.1 Nano',
  )
  console.log('='.repeat(80))
  console.log()

  // Verify env vars
  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    console.error(
      'ERROR: GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS must be set',
    )
    process.exit(1)
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY must be set')
    process.exit(1)
  }
  console.log('  Env vars: OK')
  console.log()

  const allResults: FieldResult[] = []
  let labelIndex = 0
  let totalTokensUsed = 0
  let totalOcrMs = 0
  let totalClassMs = 0

  for (const label of TEST_LABELS) {
    labelIndex++
    const labelDir = path.join(TEST_LABELS_DIR, label.dir)

    // Verify directory exists
    if (!fs.existsSync(labelDir)) {
      console.log(
        `[${labelIndex}/${TEST_LABELS.length}] SKIP: ${label.name} — directory not found: ${labelDir}`,
      )
      console.log()
      continue
    }

    // Read image files
    const buffers: Buffer[] = []
    let missingImage = false
    for (const img of label.images) {
      const imgPath = path.join(labelDir, img)
      if (!fs.existsSync(imgPath)) {
        console.log(
          `[${labelIndex}/${TEST_LABELS.length}] SKIP: ${label.name} — image not found: ${imgPath}`,
        )
        missingImage = true
        break
      }
      buffers.push(fs.readFileSync(imgPath))
    }
    if (missingImage) {
      console.log()
      continue
    }

    console.log(
      `[${labelIndex}/${TEST_LABELS.length}] Processing: ${label.name} (${label.images.join(', ')})...`,
    )

    try {
      const startMs = performance.now()
      const result = await extractLabelFieldsForSubmission(
        [],
        label.beverageType,
        label.appData,
        buffers,
      )
      const elapsedMs = Math.round(performance.now() - startMs)

      totalOcrMs += result.metrics.ocrTimeMs
      totalClassMs += result.metrics.classificationTimeMs
      totalTokensUsed += result.metrics.totalTokens

      console.log(
        `  OCR: ${result.metrics.ocrTimeMs}ms | Classification: ${result.metrics.classificationTimeMs}ms | Merge: ${result.metrics.mergeTimeMs}ms | Total: ${elapsedMs}ms | Tokens: ${result.metrics.totalTokens}`,
      )
      console.log()

      // Check each field
      for (const [fieldName, expectedValue] of Object.entries(label.appData)) {
        const extractedField = result.fields.find(
          (f) => f.fieldName === fieldName,
        )
        const extractedValue = extractedField?.value ?? null

        const comparison = compareField(
          fieldName,
          expectedValue,
          extractedValue,
        )

        const status: 'PASS' | 'FAIL' | 'NOT_FOUND' =
          comparison.status === 'match'
            ? 'PASS'
            : comparison.status === 'not_found'
              ? 'NOT_FOUND'
              : 'FAIL'

        // Truncate display for health warning
        const displayExpected =
          fieldName === 'health_warning'
            ? expectedValue.slice(0, 40) + '...'
            : expectedValue
        const displayExtracted =
          extractedValue === null
            ? 'null'
            : fieldName === 'health_warning'
              ? extractedValue.slice(0, 40) + '...'
              : extractedValue

        const statusColor =
          status === 'PASS'
            ? '\x1b[32m'
            : status === 'NOT_FOUND'
              ? '\x1b[33m'
              : '\x1b[31m'
        const reset = '\x1b[0m'

        console.log(
          `  ${statusColor}${status.padEnd(9)}${reset} ${fieldName.padEnd(25)} extracted: "${displayExtracted}"`,
        )

        allResults.push({
          label: label.name,
          field: fieldName,
          status,
          extracted: extractedValue,
          expected: expectedValue,
          confidence: comparison.confidence,
          reasoning: comparison.reasoning,
        })
      }

      console.log()
    } catch (err) {
      console.error(`  ERROR processing ${label.name}:`, err)
      console.log()
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log('='.repeat(80))
  console.log('  SUMMARY')
  console.log('='.repeat(80))

  const total = allResults.length
  const pass = allResults.filter((r) => r.status === 'PASS').length
  const fail = allResults.filter((r) => r.status === 'FAIL').length
  const notFound = allResults.filter((r) => r.status === 'NOT_FOUND').length

  console.log(`  Total fields tested: ${total}`)
  console.log(`  \x1b[32mPASS:      ${pass}\x1b[0m`)
  console.log(`  \x1b[31mFAIL:      ${fail}\x1b[0m`)
  console.log(`  \x1b[33mNOT_FOUND: ${notFound}\x1b[0m`)
  console.log(
    `  Pass rate: ${total > 0 ? ((pass / total) * 100).toFixed(1) : 0}%`,
  )
  console.log()
  console.log(`  Total OCR time:            ${totalOcrMs}ms`)
  console.log(`  Total classification time:  ${totalClassMs}ms`)
  console.log(`  Total tokens used:          ${totalTokensUsed}`)
  console.log()

  // List all failures
  const failures = allResults.filter((r) => r.status !== 'PASS')
  if (failures.length > 0) {
    console.log('-'.repeat(80))
    console.log('  ALL FAILURES')
    console.log('-'.repeat(80))
    for (const f of failures) {
      const displayExpected =
        f.field === 'health_warning'
          ? f.expected.slice(0, 60) + '...'
          : f.expected
      const displayExtracted =
        f.extracted === null
          ? 'null'
          : f.field === 'health_warning'
            ? f.extracted.slice(0, 60) + '...'
            : f.extracted
      console.log(`  [${f.status}] ${f.label} > ${f.field}`)
      console.log(`    Expected:  "${displayExpected}"`)
      console.log(`    Extracted: "${displayExtracted}"`)
      console.log(`    Reasoning: ${f.reasoning}`)
      console.log()
    }
  }

  // Per-field pass rates
  console.log('-'.repeat(80))
  console.log('  PER-FIELD PASS RATES')
  console.log('-'.repeat(80))
  const fieldNames = [...new Set(allResults.map((r) => r.field))]
  for (const fn of fieldNames) {
    const fieldResults = allResults.filter((r) => r.field === fn)
    const fieldPass = fieldResults.filter((r) => r.status === 'PASS').length
    const pct = ((fieldPass / fieldResults.length) * 100).toFixed(0)
    const bar = `${'#'.repeat(Math.round((fieldPass / fieldResults.length) * 20))}${'.'.repeat(20 - Math.round((fieldPass / fieldResults.length) * 20))}`
    console.log(
      `  ${fn.padEnd(25)} ${fieldPass}/${fieldResults.length} (${pct.padStart(3)}%) ${bar}`,
    )
  }
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
