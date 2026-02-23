/**
 * Downloads 18 TTB sample label slides and crops the left half (Approved COLA).
 * Idempotent — skips download if file already exists.
 *
 * Usage: yarn seed:prepare-images
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const OUTPUT_DIR = path.join(process.cwd(), 'test-labels', 'ttb-slides')

// Slide numbers from IMAGE_SOURCES in src/db/seed-data/image-sources.ts
const SLIDES: Array<{ slideNumber: number; name: string }> = [
  { slideNumber: 1, name: 'slide-1-rainy-day' },
  { slideNumber: 3, name: 'slide-3-pollys-spiced-ale' },
  { slideNumber: 5, name: 'slide-5-sunnyside-distillery' },
  { slideNumber: 10, name: 'slide-10-papas-winery' },
  { slideNumber: 15, name: 'slide-15-4-points' },
  { slideNumber: 20, name: 'slide-20-parker-mill' },
  { slideNumber: 22, name: 'slide-22-fire-alarm' },
  { slideNumber: 25, name: 'slide-25-bailey-best' },
  { slideNumber: 30, name: 'slide-30-red-lightning' },
  { slideNumber: 33, name: 'slide-33-big-black-cat' },
  { slideNumber: 35, name: 'slide-35-cognac' },
  { slideNumber: 40, name: 'slide-40-toris-point' },
  { slideNumber: 45, name: 'slide-45-burnett-brews' },
  { slideNumber: 50, name: 'slide-50-nicole' },
  { slideNumber: 55, name: 'slide-55-christina-wine' },
  { slideNumber: 57, name: 'slide-57-christina-beer' },
  { slideNumber: 60, name: 'slide-60-fish-creek' },
  { slideNumber: 63, name: 'slide-63-willow-hollow' },
]

function slideUrl(slideNumber: number): string {
  return `https://www.ttb.gov/system/files/images/labels/Slide${slideNumber}.jpg`
}

async function downloadAndCrop(
  slideNumber: number,
  outputName: string,
): Promise<void> {
  const outputPath = path.join(OUTPUT_DIR, `${outputName}.jpg`)

  if (fs.existsSync(outputPath)) {
    console.log(`  [skip] ${outputName}.jpg already exists`)
    return
  }

  const url = slideUrl(slideNumber)
  console.log(`  [download] Slide ${slideNumber} from ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to download slide ${slideNumber}: ${response.status} ${response.statusText}`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  // Get image dimensions
  const metadata = await sharp(buffer).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Cannot read dimensions of slide ${slideNumber}`)
  }

  // Crop the left half (Approved COLA side)
  const cropWidth = Math.floor(metadata.width / 2)
  const cropped = await sharp(buffer)
    .extract({ left: 0, top: 0, width: cropWidth, height: metadata.height })
    .jpeg({ quality: 90 })
    .toBuffer()

  fs.writeFileSync(outputPath, cropped)
  console.log(`  [saved] ${outputName}.jpg (${cropWidth}x${metadata.height})`)
}

async function main() {
  console.log('=== Preparing TTB Label Slides ===\n')

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  let downloaded = 0
  let skipped = 0

  for (const slide of SLIDES) {
    try {
      const outputPath = path.join(OUTPUT_DIR, `${slide.name}.jpg`)
      const existed = fs.existsSync(outputPath)

      await downloadAndCrop(slide.slideNumber, slide.name)

      if (existed) {
        skipped++
      } else {
        downloaded++
      }
    } catch (err) {
      console.error(`  [error] Slide ${slide.slideNumber}: ${err}`)
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`  Downloaded: ${downloaded}`)
  console.log(`  Skipped:    ${skipped}`)
  console.log(`  Output:     ${OUTPUT_DIR}`)
}

main().catch((err) => {
  console.error('Prepare TTB slides failed:', err)
  process.exit(1)
})
