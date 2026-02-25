// @vitest-environment node

/**
 * End-to-end tests for the specialist submission pipeline.
 *
 * Runs the full pipeline (OCR → rule-based classification → comparison)
 * against AI-generated test labels to verify the critical path works
 * correctly with real images.
 *
 * These tests use the actual Tesseract.js WASM engine and rule-based
 * classifier — no mocks. They take ~3-5s each due to OCR processing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractTextMultiImage } from '@/lib/ai/ocr'
import { classifyFieldsForSubmission } from '@/lib/ai/classify-fields'

const LABELS_DIR = join(process.cwd(), 'test-labels/ai-generated')

/** Helper to find a classified field by name */
function getField(
  fields: Array<{ fieldName: string; value: string | null; confidence: number }>,
  name: string,
) {
  return fields.find((f) => f.fieldName === name)
}

describe('Submission pipeline (e2e)', () => {
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

    it('finds brand_name with high confidence', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Old Tom Distillery')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds class_type with high confidence', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Vodka')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content with high confidence', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('40% Alc./Vol. (80 Proof)')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents with high confidence', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds qualifying_phrase via ampersand normalization', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Distilled and Bottled by')
      // 93 = ampersand-normalized match ("&" → "and")
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds fanciful_name with high confidence', () => {
      const f = getField(fields, 'fanciful_name')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Premium')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds health_warning via fuzzy sliding window', () => {
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.value).toBe(
        'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
      )
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds name_and_address via fuzzy sliding window', () => {
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      // OCR produces "LONSVILLE" instead of "Louisville" — fuzzy match handles it
      expect(f!.value).toBe('Old Tom Distillery, Louisville, KY')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds country_of_origin via fuzzy sliding window', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      // OCR produces "FRON PLOAN" instead of "from Poland" — fuzzy match handles it
      expect(f!.value).toBe('Imported from Poland')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
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

    it('finds class_type with high confidence', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents with high confidence', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds qualifying_phrase via ampersand normalization', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Produced and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds grape_varietal with high confidence', () => {
      const f = getField(fields, 'grape_varietal')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Cabernet Sauvignon')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds appellation_of_origin with high confidence', () => {
      const f = getField(fields, 'appellation_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Napa Valley')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds country_of_origin with high confidence', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Product of USA')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds brand_name via fuzzy sliding window', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      // OCR produces "WitLow" instead of "Willow" — fuzzy match handles it
      expect(f!.value).toBe('Willow Glen Winery')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds alcohol_content via punctuation-stripped match', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      // OCR produces "ALC. 14.5% BY VOL" vs "Alc. 14.5% By Vol." — trailing period difference
      expect(f!.value).toBe('Alc. 14.5% By Vol.')
      expect(f!.confidence).toBeGreaterThanOrEqual(85)
    })

    it('fails to find health_warning (OCR garbles small print)', () => {
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
    })

    it('fails to find sulfite_declaration (not picked up by OCR)', () => {
      const f = getField(fields, 'sulfite_declaration')
      expect(f).toBeDefined()
      expect(f!.confidence).toBe(0)
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

    it('finds class_type with high confidence', () => {
      const f = getField(fields, 'class_type')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Rye Whiskey')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds alcohol_content with high confidence', () => {
      const f = getField(fields, 'alcohol_content')
      expect(f).toBeDefined()
      expect(f!.value).toBe('49% Alc./Vol. (98 Proof)')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds net_contents with high confidence', () => {
      const f = getField(fields, 'net_contents')
      expect(f).toBeDefined()
      expect(f!.value).toBe('750 ML')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds country_of_origin with high confidence', () => {
      const f = getField(fields, 'country_of_origin')
      expect(f).toBeDefined()
      expect(f!.value).toBe('Made in USA')
      expect(f!.confidence).toBeGreaterThanOrEqual(90)
    })

    it('finds brand_name via fuzzy sliding window', () => {
      const f = getField(fields, 'brand_name')
      expect(f).toBeDefined()
      // OCR produces "SMITHOM" instead of "Smithford" — fuzzy match handles it
      expect(f!.value).toBe('Smithford Distilling')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds qualifying_phrase via fuzzy ampersand-normalized match', () => {
      const f = getField(fields, 'qualifying_phrase')
      expect(f).toBeDefined()
      // OCR produces "DISTILLED B & BOTTLED BY" (extra "B") — fuzzy match handles it
      expect(f!.value).toBe('Distilled and Bottled by')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds health_warning via fuzzy sliding window', () => {
      const f = getField(fields, 'health_warning')
      expect(f).toBeDefined()
      expect(f!.value).toBe(
        'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.',
      )
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })

    it('finds name_and_address via fuzzy sliding window', () => {
      const f = getField(fields, 'name_and_address')
      expect(f).toBeDefined()
      // OCR garbles "Smithford" — fuzzy match handles the rest
      expect(f!.value).toBe('Smithford Distilling, Bardstown, KY')
      expect(f!.confidence).toBeGreaterThanOrEqual(70)
    })
  })

  describe('Pipeline characteristics', () => {
    it('returns zero token usage (no LLM calls)', async () => {
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

      expect(usage.inputTokens).toBe(0)
      expect(usage.outputTokens).toBe(0)
      expect(usage.totalTokens).toBe(0)
    }, 30_000)
  })
})
