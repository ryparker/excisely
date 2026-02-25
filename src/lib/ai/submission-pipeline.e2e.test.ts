// @vitest-environment node

/**
 * End-to-end tests for the specialist submission pipeline.
 *
 * Runs the full pipeline (Cloud Vision OCR → GPT-4.1 classification → comparison)
 * against AI-generated test labels to verify the critical path works
 * correctly with real images.
 *
 * These tests use the actual Google Cloud Vision API and OpenAI GPT-4.1 —
 * no mocks. They take ~5-10s each due to network latency.
 *
 * Requirements:
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON env var (Cloud Vision service account)
 * - OPENAI_API_KEY env var (GPT-4.1 access)
 * - Each run costs ~$0.01-0.02 per label
 *
 * Note: GPT-4.1 returns values as read from OCR text (often UPPERCASE).
 * Assertions use case-insensitive matching since the comparison engine
 * handles case normalization separately.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractTextMultiImage } from '@/lib/ai/ocr'
import { classifyFieldsForSubmission } from '@/lib/ai/classify-fields'

const LABELS_DIR = join(process.cwd(), 'test-labels/ai-generated')

const hasCloudKeys =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
  !!process.env.OPENAI_API_KEY

/** Helper to find a classified field by name */
function getField(
  fields: Array<{
    fieldName: string
    value: string | null
    confidence: number
  }>,
  name: string,
) {
  return fields.find((f) => f.fieldName === name)
}

/** Case-insensitive comparison — GPT-4.1 returns OCR case (often UPPERCASE) */
function expectValueMatch(actual: string | null, expected: string) {
  expect(actual).not.toBeNull()
  expect(actual!.toLowerCase()).toBe(expected.toLowerCase())
}

describe.skipIf(!hasCloudKeys)('Submission pipeline (e2e)', () => {
  describe('Old Tom Vodka (distilled spirits)', () => {
    let fields: Array<{
      fieldName: string
      value: string | null
      confidence: number
      reasoning: string | null
    }>

    it('runs OCR and classification on the label', async () => {
      const img = readFileSync(join(LABELS_DIR, 'old-tom-vodka.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(30)

      const applicationData = {
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
      }

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        applicationData,
      )

      fields = result.fields
    }, 30_000)

    it('finds brand_name', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Old Tom Distillery')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds class_type', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Vodka')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      // Nano may return "40% alc./vol." or "40% alc./vol. (80 proof)" — both valid
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('40% alc./vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, '750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds qualifying_phrase', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      // Model may return "Distilled & Bottled by" or "Distilled and Bottled by"
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('distilled')
      expect(f!.value!.toLowerCase()).toContain('bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds fanciful_name', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Premium')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('attempts health_warning extraction', () => {
      // Health warning text on AI-generated labels has stylized fonts that can
      // garble even with Cloud Vision (e.g., "GOVERIMENT" for "GOVERNMENT").
      // The comparison engine handles fuzzy matching downstream.
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toUpperCase()).toContain('WARNING')
      expect(f!.confidence).toBeGreaterThanOrEqual(50)
    })

    it('finds name_and_address', () => {
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('old tom')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds country_of_origin', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      // OCR may garble "Poland" slightly (e.g., "Pldan") — check for "imported"
      expect(f!.value!.toLowerCase()).toContain('imported')
      expect(f!.confidence).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Willow Glen Cabernet (wine)', () => {
    let fields: Array<{
      fieldName: string
      value: string | null
      confidence: number
      reasoning: string | null
    }>

    it('runs OCR and classification on the label', async () => {
      const img = readFileSync(join(LABELS_DIR, 'willow-glen-cabernet.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(30)

      const applicationData = {
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
      }

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'wine',
        applicationData,
      )

      fields = result.fields
    }, 30_000)

    it('finds class_type', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, '750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds qualifying_phrase', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('produced')
      expect(f!.value!.toLowerCase()).toContain('bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds grape_varietal', () => {
      const f = getField(fields, 'grape_varietal')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds appellation_of_origin', () => {
      const f = getField(fields, 'appellation_of_origin')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Napa Valley')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds country_of_origin', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('usa')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds brand_name', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('willow glen')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!).toContain('14.5%')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('attempts health_warning extraction', () => {
      // Cloud Vision + GPT-4.1 should find the health warning on AI-generated labels
      // (clear, high-contrast text). Real-world labels with tiny print may still fail.
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      // Don't assert exact match — OCR quality varies
    })

    it('attempts sulfite_declaration extraction', () => {
      const f = getField(fields, 'sulfite_declaration')
      expect(f).toBeDefined()
      // May or may not be found depending on label layout
    })
  })

  describe('Smithford Rye Whiskey (distilled spirits)', () => {
    let fields: Array<{
      fieldName: string
      value: string | null
      confidence: number
      reasoning: string | null
    }>

    it('runs OCR and classification on the label', async () => {
      const img = readFileSync(join(LABELS_DIR, 'smithford-rye-whiskey.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      expect(ocrResults).toHaveLength(1)
      expect(ocrResults[0].words.length).toBeGreaterThan(30)

      const applicationData = {
        brand_name: 'Smithford Distilling',
        class_type: 'Rye Whiskey',
        alcohol_content: '49% Alc./Vol. (98 Proof)',
        net_contents: '750 ML',
        health_warning:
          'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
        name_and_address: 'Smithford Distilling, Bardstown, KY',
        qualifying_phrase: 'Distilled and Bottled by',
        country_of_origin: 'Made in USA',
      }

      const { result } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        applicationData,
      )

      fields = result.fields
    }, 30_000)

    it('finds class_type', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, 'Rye Whiskey')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds alcohol_content', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!).toContain('49%')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds net_contents', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expectValueMatch(f!.value, '750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds country_of_origin', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('usa')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds brand_name', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('smith')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds qualifying_phrase', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('distilled')
      expect(f!.value!.toLowerCase()).toContain('bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('attempts health_warning extraction', () => {
      // Health warning has small, dense text — OCR artifacts reduce confidence
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.confidence).toBeGreaterThanOrEqual(50)
    })

    it('finds name_and_address', () => {
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      expect(f!.value).not.toBeNull()
      expect(f!.value!.toLowerCase()).toContain('bardstown')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Pipeline characteristics', () => {
    it('uses tokens (cloud LLM classification)', async () => {
      const img = readFileSync(join(LABELS_DIR, 'old-tom-vodka.png'))
      const ocrResults = await extractTextMultiImage([img])
      const fullText = ocrResults
        .map((r, i) => `--- Image ${i + 1} ---\n${r.fullText}`)
        .join('\n\n')

      const { usage } = await classifyFieldsForSubmission(
        fullText,
        'distilled_spirits',
        { brand_name: 'Old Tom Distillery' },
      )

      // Cloud pipeline uses GPT-4.1 — should report token usage
      expect(usage.inputTokens).toBeGreaterThan(0)
      expect(usage.outputTokens).toBeGreaterThan(0)
      expect(usage.totalTokens).toBeGreaterThan(0)
    }, 30_000)
  })
})
