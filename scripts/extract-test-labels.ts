import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: true })

import fs from 'node:fs'
import path from 'node:path'
import { generateText, Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import pLimit from 'p-limit'
import { BEVERAGE_TYPES, type BeverageType } from '@/config/beverage-types'

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
// Field descriptions (reused from src/lib/ai/prompts.ts)
// ---------------------------------------------------------------------------

const FIELD_DESCRIPTIONS: Record<string, string> = {
  brand_name:
    'The brand name under which the product is sold (Form Item 6). Usually the most prominent text.',
  fanciful_name:
    'A distinctive or descriptive name that further identifies the product (Form Item 7). Separate from the brand name.',
  class_type:
    'The class, type, or other designation of the product (e.g., "Bourbon Whisky", "Cabernet Sauvignon", "India Pale Ale").',
  alcohol_content:
    'The alcohol content as shown on the label, typically expressed as "XX% Alc./Vol." or "XX% Alc/Vol" or "XX Proof".',
  net_contents:
    'The total bottle capacity / net contents (e.g., "750 mL", "1 L", "12 FL OZ").',
  health_warning:
    'The federally mandated health warning statement. Must begin with "GOVERNMENT WARNING:" in all capital letters.',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer. Includes the qualifying phrase.',
  qualifying_phrase:
    'The phrase preceding the name and address (e.g., "Bottled by", "Distilled by", "Imported by").',
  country_of_origin:
    'The country of origin statement for imported products (e.g., "Product of Scotland").',
  grape_varietal:
    'The grape variety or varieties used (wine only, e.g., "Cabernet Sauvignon").',
  appellation_of_origin:
    'The geographic origin of the grapes (wine only, e.g., "Napa Valley").',
  vintage_year: 'The year the grapes were harvested (wine only, e.g., "2021").',
  sulfite_declaration:
    'A sulfite content declaration (wine only, e.g., "Contains Sulfites").',
  age_statement:
    'An age or maturation statement (spirits only, e.g., "Aged 12 Years").',
  state_of_distillation:
    'The state where the spirit was distilled (spirits only, e.g., "Distilled in Kentucky").',
  standards_of_fill:
    'Whether the container size conforms to TTB standards of fill for the beverage type.',
}

// ---------------------------------------------------------------------------
// Zod schemas for structured output
// ---------------------------------------------------------------------------

const visionFieldSchema = z.object({
  fieldName: z.string(),
  value: z.string().nullable(),
  confidence: z.number(),
  reasoning: z.string().nullable(),
  sourceImage: z.string().nullable(),
})

const visionExtractionSchema = z.object({
  fields: z.array(visionFieldSchema),
})

// ---------------------------------------------------------------------------
// Vision extraction prompt builder
// ---------------------------------------------------------------------------

function buildVisionPrompt(
  labelName: string,
  beverageType: BeverageType,
  imageTypes: string[],
): string {
  const config = BEVERAGE_TYPES[beverageType]
  const allFields = [...config.mandatoryFields, ...config.optionalFields]

  const fieldListText = allFields
    .map((field) => {
      const desc = FIELD_DESCRIPTIONS[field] ?? field
      const mandatory = config.mandatoryFields.includes(field)
      return `- **${field}** (${mandatory ? 'MANDATORY' : 'optional'}): ${desc}`
    })
    .join('\n')

  const imageListText = imageTypes
    .map((t, i) => `  Image ${i + 1}: ${t} label`)
    .join('\n')

  return `You are analyzing alcohol beverage label images for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance verification.

## Label

Product: "${labelName}" — a **${config.label}** product.

## Images Provided

${imageListText}

## Task

Examine the label image(s) and extract the following TTB-regulated fields. For each field:
1. The exact **fieldName** (as listed below)
2. The **value** as it appears on the label (null if not visible)
3. A **confidence** score (0–100)
4. Brief **reasoning** explaining where you found this field or why it's missing
5. The **sourceImage** indicating which image contains this field ("front", "back", "neck", "top", or null if not found)

## Fields to Identify

${fieldListText}

## Important Rules

1. Extract values **exactly as printed** on the label — preserve original capitalization, punctuation, and formatting.
2. **"GOVERNMENT WARNING:" prefix is in ALL CAPS** — the health warning begins with "GOVERNMENT WARNING:" followed by two numbered statements about pregnancy and impaired driving.
3. **Alcohol content** should include the full expression (e.g., "45% Alc./Vol." not just "45").
4. **Net contents** should include units (e.g., "750 mL" not just "750").
5. **If a field is not visible** in any image, return it with value: null, confidence: 0.
6. **Qualifying phrase** is separate from name_and_address — extract "Bottled by", "Distilled by", etc. independently.
7. If text spans multiple lines, join them with a single space.
8. For back labels, carefully read small/fine print for health warning, name/address, and net contents.

## Response Format

Return a JSON object with a "fields" array containing all ${allFields.length} fields listed above (including those not found).`
}

// ---------------------------------------------------------------------------
// AI extraction with retry
// ---------------------------------------------------------------------------

async function extractWithVision(
  label: LabelEntry,
  imageBuffers: Array<{ buffer: Buffer; imageType: string }>,
  retries = 3,
): Promise<{
  result: z.infer<typeof visionExtractionSchema>
  usage: { inputTokens: number; outputTokens: number; totalTokens: number }
}> {
  const prompt = buildVisionPrompt(
    label.name,
    label.beverageType,
    imageBuffers.map((i) => i.imageType),
  )

  const imageContent = imageBuffers.map((img) => ({
    type: 'image' as const,
    image: img.buffer,
  }))

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { experimental_output, usage } = await generateText({
        model: openai('gpt-5-mini'),
        messages: [
          {
            role: 'user',
            content: [...imageContent, { type: 'text' as const, text: prompt }],
          },
        ],
        experimental_output: Output.object({
          schema: visionExtractionSchema,
        }),
      })

      if (!experimental_output) {
        throw new Error('No structured output returned from model')
      }

      return {
        result: experimental_output,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isRateLimit =
        msg.includes('429') || msg.toLowerCase().includes('rate limit')

      if (isRateLimit && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000
        console.log(
          `    Rate limited, retrying in ${delay / 1000}s (attempt ${attempt}/${retries})...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      throw err
    }
  }

  throw new Error('Exhausted all retries')
}

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
  if (dryRun) console.log('[DRY RUN] Skipping AI extraction')
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

  if (!dryRun && !process.env.OPENAI_API_KEY) {
    console.error(
      'OPENAI_API_KEY is required for AI extraction. Use --dry-run to skip.',
    )
    process.exit(1)
  }

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
      const imageBuffers: Array<{ buffer: Buffer; imageType: string }> = []

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
        imageBuffers.push({ buffer, imageType: img.imageType })
      }

      if (dryRun) {
        console.log('  [DRY RUN] Skipping AI extraction\n')
        return
      }

      if (imageBuffers.length === 0) {
        console.error('  No images found, skipping extraction\n')
        errorCount++
        return
      }

      // 3. Extract fields via GPT-5 Mini vision
      const startTime = Date.now()

      try {
        console.log(
          `  Extracting fields from ${imageBuffers.length} image(s)...`,
        )
        const { result, usage } = await extractWithVision(label, imageBuffers)
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
            modelUsed: 'gpt-5-mini',
            processingTimeMs,
            extractedAt: new Date().toISOString(),
            totalTokens: usage.totalTokens,
          },
        }

        const outPath = path.join(labelDir, 'extraction.json')
        fs.writeFileSync(outPath, JSON.stringify(extraction, null, 2))
        console.log(
          `  Extracted ${result.fields.length} fields in ${processingTimeMs}ms (${usage.totalTokens} tokens)`,
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
            modelUsed: 'gpt-5-mini',
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
