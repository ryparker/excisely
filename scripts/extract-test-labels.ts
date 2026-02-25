import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

import fs from 'node:fs'
import path from 'node:path'
import pLimit from 'p-limit'
import type { BeverageType } from '@/config/beverage-types'
import { extractLabelFieldsFromBuffers } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// Label manifest — explicit mapping of every test label
// ---------------------------------------------------------------------------

interface LabelImage {
  /** Original filename in test-labels/<category>/ */
  source: string
  /** Simplified name: front.png, back.png, neck.png, top.png */
  target: string
  /** Image type for extraction context */
  imageType: 'front' | 'back' | 'neck' | 'top'
}

interface LabelEntry {
  category: 'whiskey' | 'beer' | 'wine'
  name: string
  beverageType: BeverageType
  images: LabelImage[]
}

const LABELS: LabelEntry[] = [
  // --- Whiskey ---
  {
    category: 'whiskey',
    name: 'backbone-bourbon',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'backbone-bourbon-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'backbone-bourbon-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'bulleit-bourbon-10yr',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'bourbon-bulleit-bourbon-10yr-front.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'bulleit-frontier',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'bourbon-bulleit-frontier-front.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'bulleit-single-barrel',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'bourbon-bulleit-single-barrel-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'bourbon-bulleit-single-barrel-neck.png',
        target: 'neck.png',
        imageType: 'neck',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'knob-creek',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'bourbon-knob-creek-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'bourbon-knob-creek-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'branch-barrel-wheat',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'branch-barrel-wheat-whiskey-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'branch-barrel-wheat-whiskey-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'crafted-spirits-malinowka',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'crafted-spirits-malinowka-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'crafted-spirits-malinowka-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'dashfire-old-fashioned',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'dashfire-old-fashioned.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'bulleit-rye',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'rye-bulleit-rye-front.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  {
    category: 'whiskey',
    name: 'bulleit-old-fashioned',
    beverageType: 'distilled_spirits',
    images: [
      {
        source: 'whiskey-bulleit-old-fashioned-front.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  // --- Beer ---
  {
    category: 'beer',
    name: 'sierra-nevada',
    beverageType: 'malt_beverage',
    images: [
      {
        source: 'beer-sierra-nevada-front.png',
        target: 'front.png',
        imageType: 'front',
      },
    ],
  },
  {
    category: 'beer',
    name: 'twisted-tea-light-lemon',
    beverageType: 'malt_beverage',
    images: [
      {
        source: 'twisted-tea-light-lemon-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'twisted-tea-light-lemon-top.png',
        target: 'top.png',
        imageType: 'top',
      },
    ],
  },
  // --- Wine ---
  {
    category: 'wine',
    name: 'cooper-ridge-malbec',
    beverageType: 'wine',
    images: [
      {
        source: 'cooper-ridge-malbec-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'cooper-ridge-malbec-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'wine',
    name: 'forever-summer',
    beverageType: 'wine',
    images: [
      {
        source: 'forever-summer-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'forever-summer-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'wine',
    name: 'jourdan-croix-boissee',
    beverageType: 'wine',
    images: [
      {
        source: 'jourdan-croix-boissee-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'jourdan-croix-boissee-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'wine',
    name: 'three-fox-viognier',
    beverageType: 'wine',
    images: [
      {
        source: 'three-fox-viognier-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'three-fox-viognier-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
  {
    category: 'wine',
    name: 'domaine-montredon',
    beverageType: 'wine',
    images: [
      {
        source: 'wine-domaine-montredon-front.png',
        target: 'front.png',
        imageType: 'front',
      },
      {
        source: 'wine-domaine-montredon-back.png',
        target: 'back.png',
        imageType: 'back',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  dryRun: boolean
  only: string | null
  concurrency: number
} {
  const args = process.argv.slice(2)
  let dryRun = false
  let only: string | null = null
  let concurrency = 1

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true
    } else if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length)
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = parseInt(arg.slice('--concurrency='.length), 10)
      if (isNaN(concurrency) || concurrency < 1) concurrency = 1
    }
  }

  return { dryRun, only, concurrency }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun, only, concurrency } = parseArgs()
  const rootDir = path.join(process.cwd(), 'test-labels')

  console.log('=== Extract TTB Label Data from Test Images ===')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log(`Pipeline: Tesseract.js (WASM) + rule-based classification`)
  if (dryRun) console.log('[DRY RUN] Skipping extraction')
  if (only) console.log(`[FILTER] Only processing: ${only}`)
  console.log(`[CONCURRENCY] ${concurrency}`)

  // Filter labels
  const labelsToProcess = only ? LABELS.filter((l) => l.name === only) : LABELS

  if (labelsToProcess.length === 0) {
    console.error(`No label found matching --only=${only}`)
    console.log('Available labels:', LABELS.map((l) => l.name).join(', '))
    process.exit(1)
  }

  console.log(`\nProcessing ${labelsToProcess.length} labels\n`)

  const limit = pLimit(concurrency)
  let successCount = 0
  let errorCount = 0

  const tasks = labelsToProcess.map((label) =>
    limit(async () => {
      const labelDir = path.join(rootDir, label.category, label.name)
      console.log(`--- ${label.name} (${label.beverageType}) ---`)

      // 1. Create directory
      fs.mkdirSync(labelDir, { recursive: true })
      console.log(`  Created: ${path.relative(process.cwd(), labelDir)}/`)

      // 2. Copy images with simplified names
      const imageBuffers: Buffer[] = []

      for (const img of label.images) {
        const sourcePath = path.join(rootDir, label.category, img.source)

        if (!fs.existsSync(sourcePath)) {
          console.error(`  MISSING: ${img.source}`)
          continue
        }

        const targetPath = path.join(labelDir, img.target)
        fs.copyFileSync(sourcePath, targetPath)
        console.log(`  Copied: ${img.source} → ${label.name}/${img.target}`)

        const buffer = fs.readFileSync(targetPath)
        imageBuffers.push(buffer)
      }

      if (dryRun) {
        console.log('  [DRY RUN] Skipping extraction\n')
        return
      }

      if (imageBuffers.length === 0) {
        console.error('  No images found, skipping extraction\n')
        errorCount++
        return
      }

      // 3. Extract fields via local pipeline (Tesseract.js + rule-based)
      const startTime = Date.now()

      try {
        console.log(
          `  Extracting fields from ${imageBuffers.length} image(s)...`,
        )
        const result = await extractLabelFieldsFromBuffers(
          imageBuffers,
          label.beverageType,
        )
        const processingTimeMs = Date.now() - startTime

        // 4. Build extraction.json
        const fields: Record<string, string | null> = {}
        for (const f of result.fields) {
          fields[f.fieldName] = f.value
        }

        const extraction = {
          labelName: label.name,
          beverageType: label.beverageType,
          images: label.images.map((img) => ({
            filename: img.target,
            imageType: img.imageType,
          })),
          fields,
          fieldDetails: result.fields,
          metadata: {
            modelUsed: 'tesseract+rules',
            processingTimeMs,
            extractedAt: new Date().toISOString(),
            totalTokens: 0,
          },
        }

        const outPath = path.join(labelDir, 'extraction.json')
        fs.writeFileSync(outPath, JSON.stringify(extraction, null, 2))
        console.log(
          `  Extracted ${result.fields.length} fields in ${processingTimeMs}ms`,
        )
        console.log(`  Wrote: ${path.relative(process.cwd(), outPath)}\n`)
        successCount++
      } catch (err) {
        const processingTimeMs = Date.now() - startTime
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ERROR: ${msg.slice(0, 200)}`)

        // Write partial extraction.json with error
        const extraction = {
          labelName: label.name,
          beverageType: label.beverageType,
          images: label.images.map((img) => ({
            filename: img.target,
            imageType: img.imageType,
          })),
          fields: {},
          fieldDetails: [],
          error: msg,
          metadata: {
            modelUsed: 'tesseract+rules',
            processingTimeMs,
            extractedAt: new Date().toISOString(),
            totalTokens: 0,
          },
        }

        const outPath = path.join(labelDir, 'extraction.json')
        fs.writeFileSync(outPath, JSON.stringify(extraction, null, 2))
        console.log(
          `  Wrote partial: ${path.relative(process.cwd(), outPath)}\n`,
        )
        errorCount++
      }
    }),
  )

  await Promise.all(tasks)

  // Summary
  console.log('=== Done ===')
  console.log(`Total: ${labelsToProcess.length} labels`)
  if (!dryRun) {
    console.log(`  Success: ${successCount}`)
    if (errorCount > 0) console.log(`  Errors: ${errorCount}`)
  } else {
    console.log('  Directories created and images copied (dry run)')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
