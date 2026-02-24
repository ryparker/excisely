import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const BASE_DIR = '/Users/ryanparker/GitHub/treasury-take-home/test-labels'

// Create directories
;['whiskey', 'wine', 'beer'].forEach((d) => {
  const dir = join(BASE_DIR, d)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// All COLAs to try downloading, in order
const colas = [
  // Whiskey/Bourbon
  {
    ttbid: '25085001000195',
    name: 'knob-creek',
    category: 'whiskey',
    prefix: 'bourbon',
  },
  {
    ttbid: '25093001000227',
    name: 'bulleit-rye',
    category: 'whiskey',
    prefix: 'rye',
  },
  {
    ttbid: '25136001000083',
    name: 'bulleit-old-fashioned',
    category: 'whiskey',
    prefix: 'whiskey',
  },
  {
    ttbid: '25150001000553',
    name: 'bulleit-bourbon-10yr',
    category: 'whiskey',
    prefix: 'bourbon',
  },
  // Wine
  {
    ttbid: '24001001000011',
    name: 'cooper-ridge-malbec',
    category: 'wine',
    prefix: 'wine',
  },
  {
    ttbid: '24001001000015',
    name: 'domaine-montredon',
    category: 'wine',
    prefix: 'wine',
  },
  {
    ttbid: '24001001000016',
    name: 'dashfire-cocktail',
    category: 'wine',
    prefix: 'wine',
  },
]

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)

  // First establish session by visiting the search page
  console.log('Establishing session...')
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.goto(
        'https://ttbonline.gov/colasonline/publicSearchColasBasic.do',
        { waitUntil: 'load', timeout: 15000 },
      )
      console.log('Session established!')
      break
    } catch (e) {
      console.log(
        `  Attempt ${attempt + 1} failed, retrying in ${(attempt + 1) * 3}s...`,
      )
      await sleep((attempt + 1) * 3000)
    }
  }

  async function downloadLabelsFromCola(ttbid, name, category, prefix) {
    console.log(`\nProcessing ${prefix}-${name} (${ttbid})...`)

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `https://ttbonline.gov/colasonline/viewColaDetails.do?action=publicFormDisplay&ttbid=${ttbid}`
        await page.goto(url, { waitUntil: 'load', timeout: 20000 })
        await sleep(4000) // Wait for images to load

        const images = await page.evaluate(() => {
          const imgs = document.querySelectorAll('img[alt^="Label Image"]')
          return Array.from(imgs).map((img, i) => ({
            index: i,
            alt: img.alt,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            loaded: img.complete && img.naturalWidth > 0,
          }))
        })

        if (images.length === 0) {
          console.log(`  No label images found for ${ttbid}`)
          return []
        }

        console.log(`  Found ${images.length} label images`)

        await page.evaluate(() => {
          const imgs = document.querySelectorAll('img[alt^="Label Image"]')
          imgs.forEach((img, i) => (img.id = 'label-img-' + i))
        })

        const saved = []
        for (const img of images) {
          if (!img.loaded || img.naturalWidth === 0) {
            console.log(`  Skipping image ${img.index} (not loaded)`)
            continue
          }

          let type = 'other'
          if (img.alt.includes('front') || img.alt.includes('Brand'))
            type = 'front'
          else if (img.alt.includes('Back')) type = 'back'
          else if (img.alt.includes('Neck')) type = 'neck'
          else if (img.alt.includes('Strip')) type = 'strip'

          const sameTypeCount = images.filter(
            (i2) => i2.index <= img.index && i2.alt === img.alt,
          ).length
          const suffix = sameTypeCount > 1 ? `-${sameTypeCount}` : ''

          const filename = `${prefix}-${name}-${type}${suffix}.png`
          const filepath = join(BASE_DIR, category, filename)

          try {
            const element = page.locator(`#label-img-${img.index}`)
            await element.screenshot({ path: filepath, type: 'png' })
            console.log(
              `  Saved: ${filename} (${img.naturalWidth}x${img.naturalHeight})`,
            )
            saved.push(filename)
          } catch (e) {
            console.log(`  Error saving ${filename}: ${e.message}`)
          }
        }

        await sleep(2000) // Be polite
        return saved
      } catch (e) {
        console.log(
          `  Attempt ${attempt + 1} failed: ${e.message.split('\n')[0]}`,
        )
        await sleep((attempt + 1) * 5000)
      }
    }
    return []
  }

  async function searchAndDownload(searchTerm, category, prefix) {
    console.log(`\nSearching for "${searchTerm}"...`)

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(
          'https://ttbonline.gov/colasonline/publicSearchColasBasic.do',
          { waitUntil: 'load', timeout: 15000 },
        )
        await sleep(2000)

        await page.locator('#productname').fill(searchTerm)
        await page.getByRole('button', { name: 'Search' }).click()
        await page.waitForURL('**/publicSearchColasBasicProcess*', {
          timeout: 15000,
        })
        await sleep(2000)

        const ttbids = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href*="viewColaDetails"]')
          return Array.from(links).map((a) => a.textContent.trim())
        })

        if (ttbids.length === 0) {
          console.log(`  No results for "${searchTerm}"`)
          return
        }

        console.log(`  Found ${ttbids.length} COLAs. Trying first 3...`)

        for (const ttbid of ttbids.slice(0, 3)) {
          const saved = await downloadLabelsFromCola(
            ttbid,
            searchTerm.toLowerCase().replace(/\s+/g, '-'),
            category,
            prefix,
          )
          if (saved.length > 0) return
        }
        return
      } catch (e) {
        console.log(
          `  Attempt ${attempt + 1} failed: ${e.message.split('\n')[0]}`,
        )
        await sleep((attempt + 1) * 5000)
      }
    }
  }

  // Download known COLAs
  for (const cola of colas) {
    await downloadLabelsFromCola(
      cola.ttbid,
      cola.name,
      cola.category,
      cola.prefix,
    )
  }

  // Search for beer
  await searchAndDownload('Sierra Nevada', 'beer', 'beer')
  await searchAndDownload('Blue Moon', 'beer', 'beer')

  // Search for wine
  await searchAndDownload('Barefoot', 'wine', 'wine')
  await searchAndDownload('Woodbridge', 'wine', 'wine')

  // More whiskey
  await searchAndDownload('Wild Turkey', 'whiskey', 'bourbon')

  await browser.close()
  console.log('\nDone!')
}

main().catch(console.error)
