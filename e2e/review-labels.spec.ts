import { test, expect } from '@playwright/test'

/**
 * Specialist review E2E tests.
 *
 * Reviews pending_review labels to create realistic variance across applicants:
 *
 *   Napa Valley Estate (good)   — 5/5 approved   → 100% → LOW RISK (green)
 *   Old Tom Distillery (bad)    — 1/6 approved    →  17% → HIGH RISK (red)
 *   Cascade Hop Brewing (mixed) — 5/6 approved    →  83% → MEDIUM RISK (amber)
 *
 * Strategies:
 *   - approve:      No flagged fields → click "Approve Label"
 *   - approve_all:  Has flagged fields → "Confirm Match" on each → approve
 *   - deny_all:     Has flagged fields → "Mark Mismatch" on each → deny/corrections
 *   - deny_not_found: Has not_found fields → confirm not_found → deny/corrections
 */

const SPECIALIST_AUTH = 'e2e/.auth/specialist.json'

interface ReviewCase {
  labelId: string
  brand: string
  applicant: 'old-tom' | 'napa' | 'cascade'
  strategy: 'approve' | 'approve_all' | 'deny_all' | 'deny_not_found'
  notes?: string
}

// ---------------------------------------------------------------------------
// Review cases — IDs from the E2E submission run.
//
// To refresh IDs after re-running submissions:
//   psql "$DATABASE_URL" -c "SELECT l.id, ad.brand_name, a.company_name
//     FROM labels l JOIN application_data ad ON ad.label_id = l.id
//     LEFT JOIN applicants a ON a.id = l.applicant_id
//     WHERE l.status = 'pending_review' ORDER BY l.created_at DESC;"
// ---------------------------------------------------------------------------

const REVIEW_CASES: ReviewCase[] = [
  // =========================================================================
  // Napa Valley Estate Wines — "Good" Applicant (5/5 approved → LOW RISK)
  // Always submits accurate data. Specialist approves everything.
  // =========================================================================
  {
    labelId: 'D2HEJJFx4KaHx0p3EeoQD',
    brand: 'Cooper Ridge',
    applicant: 'napa',
    strategy: 'approve',
  },
  {
    labelId: '6-n7EaW5Pp2Rhqw6Wt_3n',
    brand: 'Forever Summer',
    applicant: 'napa',
    strategy: 'approve',
  },
  {
    labelId: 'wDGMigksRDHlNqFdJkZLE',
    brand: 'Three Fox Vineyards',
    applicant: 'napa',
    strategy: 'approve',
  },
  {
    labelId: 'xZP9CcdSFsnw0eOz7-7V8',
    brand: 'Domaine Jourdan',
    applicant: 'napa',
    strategy: 'approve',
  },
  {
    labelId: '84-3k3sAFmEL0hUUK4GCO',
    brand: 'Domaine de Montredon',
    applicant: 'napa',
    strategy: 'approve_all', // AI flagged a minor formatting diff — specialist confirms match
    notes:
      'Minor formatting difference in alcohol content, values are equivalent.',
  },

  // =========================================================================
  // Old Tom Distillery — "Bad" Applicant (1/6 approved → HIGH RISK)
  // Frequently submits data that doesn't match their labels.
  // Specialist confirms the mismatches and requests corrections.
  // =========================================================================
  {
    labelId: 'OAcXergBzrN15FfCSUh_w',
    brand: 'Backbone Bourbon',
    applicant: 'old-tom',
    strategy: 'deny_all',
    notes: 'Alcohol content on application (45%) does not match label (57%).',
  },
  {
    labelId: 'qMWaXsJt5fz5ZrE2JYhr4',
    brand: 'Bulleit',
    applicant: 'old-tom',
    strategy: 'deny_all',
    notes: 'Brand name "Old Tom Reserve" does not match label "Bulleit".',
  },
  {
    labelId: 'vTBU5jvf_CHd8RRhXZx1W',
    brand: 'Knob Creek',
    applicant: 'old-tom',
    strategy: 'deny_all',
    notes: 'Net contents 375 mL does not match label 750 mL.',
  },
  {
    labelId: 'EK5vapc34yWjt0BNSVzBW',
    brand: 'Bulleit Bourbon',
    applicant: 'old-tom',
    strategy: 'deny_all',
    notes:
      'Fanciful name "Double Barrel" does not match label "Single Barrel".',
  },
  {
    labelId: 'XZT3d0imz4SDICv82BS4x',
    brand: 'Branch & Barrel',
    applicant: 'old-tom',
    strategy: 'deny_not_found', // has a not_found field — confirm it
    notes: 'Required field not found on label image.',
  },
  {
    labelId: '4dSVifGMuWTVr5Yv2oKyF',
    brand: 'Old Tom Reserve',
    applicant: 'old-tom',
    strategy: 'approve_all', // brand mismatch flagged — specialist overrides to match (lenient)
    notes:
      'Applicant submitted brand as "Old Tom Reserve" but label shows Bulleit. Accepting as variant.',
  },

  // =========================================================================
  // Cascade Hop Brewing — "Mixed" Applicant (5/6 approved → MEDIUM RISK)
  // Usually careful, occasional mistakes. Specialist is lenient on minor issues.
  // =========================================================================
  {
    labelId: '48_bdz8P5wqpwVvtuMc86',
    brand: 'Sierra Nevada',
    applicant: 'cascade',
    strategy: 'approve',
  },
  {
    labelId: 'GnYUuiT_M7fEwnxi78crH',
    brand: 'Crafted Spirits by Arkadius',
    applicant: 'cascade',
    strategy: 'approve',
  },
  {
    labelId: 'PLV9o0sZR1wkhtHS9UslF',
    brand: 'Twisted Tea',
    applicant: 'cascade',
    strategy: 'approve',
  },
  {
    labelId: 'QHsOki5UnBl-WRWN2se-R',
    brand: 'Dashfire',
    applicant: 'cascade',
    strategy: 'approve',
  },
  {
    labelId: 'YEKp_x8S71PLdL4SDijDX',
    brand: 'Bulleit 95 Rye',
    applicant: 'cascade',
    strategy: 'approve_all', // minor diff — specialist overrides to match
    notes:
      'Class/type designation is close enough — "Frontier Whiskey" vs "Rye Whiskey".',
  },
  {
    labelId: 'yRrUXxG0AelDoMlElNcp1',
    brand: 'Bulleit',
    applicant: 'cascade',
    strategy: 'deny_all',
    notes: 'Alcohol content 40% on application does not match label 37.5%.',
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const reviewOffset = Number(process.env.E2E_REVIEW_OFFSET) || 0
const reviewLimit = Number(process.env.E2E_REVIEW_LIMIT) || REVIEW_CASES.length

test.describe('Specialist Reviews', () => {
  test.use({ storageState: SPECIALIST_AUTH })

  const cases = REVIEW_CASES.slice(reviewOffset, reviewOffset + reviewLimit)

  for (let i = 0; i < cases.length; i++) {
    const rc = cases[i]
    const strategyLabel =
      rc.strategy === 'approve'
        ? 'approve'
        : rc.strategy === 'approve_all'
          ? 'override→approve'
          : rc.strategy === 'deny_not_found'
            ? 'not-found→deny'
            : 'deny'

    test(`review #${i + 1} [${rc.applicant}] ${rc.brand} (${strategyLabel})`, async ({
      page,
    }) => {
      test.setTimeout(60_000)

      // Navigate to label detail
      await page.goto(`/labels/${rc.labelId}`)

      // Wait for page to load — either review UI (reviewable) or read-only view (already reviewed)
      await page.waitForLoadState('networkidle', { timeout: 20000 })

      // If the label was already reviewed in a prior run, the review UI won't appear.
      // Check for a non-reviewable status badge and skip gracefully.
      const reviewHeading = page
        .getByRole('heading', { name: /flagged fields|matched fields/i })
        .first()
      const isReviewable = await reviewHeading.isVisible().catch(() => false)

      if (!isReviewable) {
        // Label already reviewed — verify it shows a final status badge
        const finalStatus = page.getByText(
          /^(Approved|Needs Correction|Conditionally Approved|Rejected)$/,
        )
        await expect(finalStatus.first()).toBeVisible({ timeout: 5000 })
        return // Already reviewed — pass
      }

      // =================================================================
      // Strategy: approve — no flagged fields, button is ready
      // =================================================================
      if (rc.strategy === 'approve') {
        const btn = page.getByRole('button', { name: /approve label/i })
        await expect(btn).toBeEnabled({ timeout: 5000 })
        await btn.click()
        await page.waitForURL('/', { timeout: 15000 })
        return
      }

      // =================================================================
      // Strategy: approve_all — confirm every flag as match
      // =================================================================
      if (rc.strategy === 'approve_all') {
        const confirmBtns = page.getByRole('button', {
          name: /confirm match/i,
        })
        const count = await confirmBtns.count()
        for (let j = 0; j < count; j++) {
          await confirmBtns.nth(j).click()
        }

        // Add reviewer notes
        if (rc.notes) {
          const textarea = page
            .locator('textarea[placeholder*="reviewer notes"]')
            .first()
          if (await textarea.isVisible()) {
            await textarea.fill(rc.notes)
          }
        }

        // Submit — should be "Approve Label"
        const btn = page.getByRole('button', { name: /approve label/i })
        await expect(btn).toBeEnabled({ timeout: 5000 })
        await btn.click()
        await page.waitForURL('/', { timeout: 15000 })
        return
      }

      // =================================================================
      // Strategy: deny_all — mark every flag as mismatch
      // =================================================================
      if (rc.strategy === 'deny_all') {
        const mismatchBtns = page.getByRole('button', {
          name: /mark mismatch/i,
        })
        const count = await mismatchBtns.count()
        for (let j = 0; j < count; j++) {
          await mismatchBtns.nth(j).click()
        }

        if (rc.notes) {
          const textarea = page
            .locator('textarea[placeholder*="reviewer notes"]')
            .first()
          if (await textarea.isVisible()) {
            await textarea.fill(rc.notes)
          }
        }

        // Submit — could be "Request Corrections", "Reject Label", or "Conditionally Approve"
        const btn = page.getByRole('button', {
          name: /request corrections|reject label|conditionally approve/i,
        })
        await expect(btn).toBeEnabled({ timeout: 5000 })
        await btn.click()
        await page.waitForURL('/', { timeout: 15000 })
        return
      }

      // =================================================================
      // Strategy: deny_not_found — confirm not_found flags
      // =================================================================
      if (rc.strategy === 'deny_not_found') {
        // For not_found fields, click "Mark Not Found" to confirm the AI result
        const notFoundBtns = page.getByRole('button', {
          name: /mark not found/i,
        })
        const count = await notFoundBtns.count()

        if (count > 0) {
          for (let j = 0; j < count; j++) {
            await notFoundBtns.nth(j).click()
          }
        }

        // Also handle any mismatch flags present
        const mismatchBtns = page.getByRole('button', {
          name: /mark mismatch/i,
        })
        const mismatchCount = await mismatchBtns.count()
        for (let j = 0; j < mismatchCount; j++) {
          await mismatchBtns.nth(j).click()
        }

        if (rc.notes) {
          const textarea = page
            .locator('textarea[placeholder*="reviewer notes"]')
            .first()
          if (await textarea.isVisible()) {
            await textarea.fill(rc.notes)
          }
        }

        const btn = page.getByRole('button', {
          name: /request corrections|reject label|conditionally approve/i,
        })
        await expect(btn).toBeEnabled({ timeout: 5000 })
        await btn.click()
        await page.waitForURL('/', { timeout: 15000 })
      }
    })
  }
})
