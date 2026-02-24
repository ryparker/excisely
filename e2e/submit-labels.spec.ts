import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

import { LABEL_TEST_CASES, type LabelTestCase } from './label-data'

/**
 * Resolve the effective value for a field — uses the override if present,
 * otherwise falls back to the accurate base value.
 */
function effectiveValue<K extends keyof LabelTestCase>(
  label: LabelTestCase,
  field: K,
): LabelTestCase[K] {
  if (label.overrides && field in label.overrides) {
    return label.overrides[
      field as keyof typeof label.overrides
    ] as LabelTestCase[K]
  }
  return label[field]
}

// Map beverage type enum values to the button labels in the UI
const BEVERAGE_BUTTON_LABELS: Record<LabelTestCase['beverageType'], RegExp> = {
  distilled_spirits: /distilled spirits/i,
  wine: /wine/i,
  malt_beverage: /malt beverages/i,
}

// Run tests sequentially — each submission is independent but shares DB state
test.describe('Submit Labels', () => {
  // Filter to labels whose images all exist on disk
  const allAvailable = LABEL_TEST_CASES.filter((label) => {
    const absPaths = label.imagePaths.map((p) => path.resolve(process.cwd(), p))
    return absPaths.every((p) => fs.existsSync(p))
  })

  // Offset + limit for incremental runs (default: first 3 = 1 per applicant)
  const offset = Number(process.env.E2E_LABEL_OFFSET) || 0
  const limit = Number(process.env.E2E_LABEL_LIMIT) || 3
  const availableLabels = allAvailable.slice(offset, offset + limit)

  for (let i = 0; i < availableLabels.length; i++) {
    const label = availableLabels[i]
    const hasOverrides =
      label.overrides && Object.keys(label.overrides).length > 0
    const suffix = hasOverrides ? ' (mismatch)' : ''

    test(`submit #${i + 1} [${label.applicant}] ${label.brandName}${suffix}`, async ({
      browser,
    }) => {
      // Mark as slow — each test involves real AI API calls (OCR + classification)
      test.slow()

      // Each label uses its own applicant's auth state
      const context = await browser.newContext({
        storageState: label.authState,
      })
      const page = await context.newPage()

      try {
        // Capture console messages for debugging
        const consoleMessages: string[] = []
        page.on('console', (msg) => {
          consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
        })

        // -----------------------------------------------------------------
        // Phase 1: Navigate + upload images
        // -----------------------------------------------------------------
        await page.goto('/submit')
        await expect(
          page.getByRole('heading', { name: /submit label application/i }),
        ).toBeVisible()

        // Wait for Phase 1 upload area
        await expect(
          page.getByRole('heading', { name: /upload label images/i }),
        ).toBeVisible()

        // Upload via the hidden file input
        const absImagePaths = label.imagePaths.map((p) =>
          path.resolve(process.cwd(), p),
        )
        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(absImagePaths)

        // Wait for image preview to appear (filename appears as alt text)
        const firstFileName = path.basename(label.imagePaths[0])
        await expect(page.locator(`img[alt="${firstFileName}"]`)).toBeVisible({
          timeout: 10000,
        })

        // Click "Skip — fill in manually" to reveal beverage type + form
        await page.getByText('Skip — fill in manually').click()

        // -----------------------------------------------------------------
        // Phase 2: Select beverage type
        // -----------------------------------------------------------------
        await expect(
          page.getByRole('heading', { name: /what type of product/i }),
        ).toBeVisible({ timeout: 10000 })

        // Click the beverage type button
        await page
          .getByRole('button', {
            name: BEVERAGE_BUTTON_LABELS[label.beverageType],
          })
          .click()

        // -----------------------------------------------------------------
        // Phase 3: Fill form fields + submit
        // -----------------------------------------------------------------
        // Wait for Phase 3 to appear
        await expect(
          page.getByRole('heading', { name: /enter application data/i }),
        ).toBeVisible({ timeout: 10000 })

        // Serial Number (Item 4)
        await page.locator('#serialNumber').fill(label.serialNumber)

        // Brand Name (required) — use override if present
        const brandValue = effectiveValue(label, 'brandName')
        await page.locator('#brandName').fill(brandValue)

        // Container Size (required)
        const containerSize = effectiveValue(label, 'containerSizeMl')
        await page.locator('#containerSizeMl').fill(String(containerSize))

        // Optional fields — fill if base or override value exists
        const classType = effectiveValue(label, 'classType')
        if (classType) {
          await page.locator('#classType').fill(classType)
        }

        const alcoholContent = effectiveValue(label, 'alcoholContent')
        if (alcoholContent) {
          await page.locator('#alcoholContent').fill(alcoholContent)
        }

        const netContents = effectiveValue(label, 'netContents')
        if (netContents) {
          await page.locator('#netContents').fill(netContents)
        }

        const fancifulName = effectiveValue(label, 'fancifulName')
        if (fancifulName) {
          await page.locator('#fancifulName').fill(fancifulName)
        }

        // Submit the form
        await page.getByRole('button', { name: /submit application/i }).click()

        // -----------------------------------------------------------------
        // Wait for redirect — AI pipeline runs server-side (up to 120s)
        // -----------------------------------------------------------------
        const result = await Promise.race([
          page
            .waitForURL(/\/submissions\/[a-zA-Z0-9_-]+/, { timeout: 120000 })
            .then(() => 'redirected' as const),
          page
            .locator('[data-sonner-toast][data-type="error"]')
            .first()
            .waitFor({ timeout: 120000 })
            .then(async () => {
              const text = await page
                .locator('[data-sonner-toast][data-type="error"]')
                .first()
                .textContent()
              return `toast-error: ${text}` as const
            }),
        ])

        if (result !== 'redirected') {
          console.log(
            `\n--- Console for [${label.applicant}] ${label.brandName} ---`,
          )
          for (const msg of consoleMessages) console.log(msg)
          throw new Error(`Form submission failed: ${result}`)
        }

        // Assert: brand name visible on the submission detail page
        // Use the base brand name for the assertion (what the label actually says)
        // unless the override changed the brand name (then use the override since
        // that's what was submitted)
        await expect(page.getByText(brandValue).first()).toBeVisible({
          timeout: 10000,
        })
      } finally {
        await context.close()
      }
    })
  }
})
