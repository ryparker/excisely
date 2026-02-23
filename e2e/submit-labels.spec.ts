import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

import { LABEL_TEST_CASES } from './label-data'

// Run tests sequentially but don't stop on failure — each submission is independent
test.describe('Submit Labels', () => {
  // Filter to labels whose images all exist on disk
  const allAvailable = LABEL_TEST_CASES.filter((label) => {
    const absPaths = label.imagePaths.map((p) => path.resolve(process.cwd(), p))
    return absPaths.every((p) => fs.existsSync(p))
  })

  // Offset + limit for incremental runs
  const offset = Number(process.env.E2E_LABEL_OFFSET) || 0
  const limit = Number(process.env.E2E_LABEL_LIMIT) || 3
  const availableLabels = allAvailable.slice(offset, offset + limit)

  for (let i = 0; i < availableLabels.length; i++) {
    const label = availableLabels[i]
    test(`submit #${i + 1} ${label.brandName}`, async ({ browser }) => {
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

        // 1. Navigate to submit page
        await page.goto('/submit')
        await expect(
          page.getByRole('heading', { name: /submit cola application/i }),
        ).toBeVisible()

        // 2. Select beverage type
        const beverageLabel =
          label.beverageType === 'distilled_spirits'
            ? 'Distilled Spirits'
            : label.beverageType === 'wine'
              ? 'Wine'
              : 'Malt Beverages'
        await page.getByText(beverageLabel, { exact: false }).click()

        // 3. Enter container size
        await page
          .getByLabel(/total bottle capacity/i)
          .fill(String(label.containerSizeMl))

        // 4. Enter brand name
        await page.getByLabel(/brand name/i).fill(label.brandName)

        // 5. Enter optional fields if provided
        if (label.classType) {
          await page
            .getByLabel(/class\/type designation/i)
            .fill(label.classType)
        }
        if (label.alcoholContent) {
          await page.getByLabel(/alcohol content/i).fill(label.alcoholContent)
        }
        if (label.netContents) {
          await page.getByLabel(/net contents/i).fill(label.netContents)
        }
        if (label.fancifulName) {
          await page.getByLabel(/fanciful name/i).fill(label.fancifulName)
        }

        // 6. Upload image(s) via the dropzone's hidden file input
        const absImagePaths = label.imagePaths.map((p) =>
          path.resolve(process.cwd(), p),
        )
        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(absImagePaths)

        // 7. Wait for image preview to appear
        await expect(page.locator('img[alt]').first()).toBeVisible({
          timeout: 10000,
        })

        // 8. Submit the form
        await page.getByRole('button', { name: /submit application/i }).click()

        // 9. Wait for redirect to /submissions/[id] — AI pipeline runs during submit
        //    If the form shows an error toast instead of redirecting, fail fast
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
          // Log console messages for debugging
          console.log(`\n--- Console for ${label.brandName} ---`)
          for (const msg of consoleMessages) console.log(msg)
          throw new Error(`Form submission failed: ${result}`)
        }

        // 10. Assert: page loaded with brand name visible
        await expect(page.getByText(label.brandName).first()).toBeVisible({
          timeout: 10000,
        })

        // 11. Assert: status badge is visible (not "processing")
        const statusBadge = page.locator('[data-testid="status-badge"]').first()
        if (await statusBadge.isVisible()) {
          const statusText = await statusBadge.textContent()
          expect(statusText).not.toContain('Processing')
        }
      } finally {
        await context.close()
      }
    })
  }
})
