import {
  addDays,
  buildExpectedFields,
  determineOverallStatus,
  MINOR_DISCREPANCY_FIELDS,
  REJECTION_FIELDS,
  CONDITIONAL_DEADLINE_DAYS,
  CORRECTION_DEADLINE_DAYS,
} from '@/lib/labels/validation-helpers'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------

describe('addDays', () => {
  it('adds positive days to a date', () => {
    const base = new Date('2026-01-10T00:00:00Z')
    const result = addDays(base, 5)
    expect(result.toISOString()).toBe('2026-01-15T00:00:00.000Z')
  })

  it('handles month boundary correctly', () => {
    const base = new Date('2026-01-28T00:00:00Z')
    const result = addDays(base, 7)
    expect(result.toISOString()).toBe('2026-02-04T00:00:00.000Z')
  })

  it('does not mutate the original date', () => {
    const base = new Date('2026-03-01T00:00:00Z')
    const originalTime = base.getTime()
    addDays(base, 10)
    expect(base.getTime()).toBe(originalTime)
  })

  it('handles zero days', () => {
    const base = new Date('2026-06-15T12:00:00Z')
    const result = addDays(base, 0)
    expect(result.toISOString()).toBe(base.toISOString())
  })
})

// ---------------------------------------------------------------------------
// buildExpectedFields
// ---------------------------------------------------------------------------

describe('buildExpectedFields', () => {
  it('maps camelCase keys to snake_case field names', () => {
    const data = { brandName: 'Old Tom', classType: 'Bourbon' }
    const fields = buildExpectedFields(data, 'distilled_spirits')
    expect(fields.get('brand_name')).toBe('Old Tom')
    expect(fields.get('class_type')).toBe('Bourbon')
  })

  it('always includes health_warning even when not provided', () => {
    const fields = buildExpectedFields({}, 'distilled_spirits')
    expect(fields.get('health_warning')).toBe(HEALTH_WARNING_FULL)
  })

  it('converts sulfiteDeclaration boolean to text', () => {
    const fields = buildExpectedFields({ sulfiteDeclaration: true }, 'wine')
    expect(fields.get('sulfite_declaration')).toBe('Contains Sulfites')
  })

  it('does not include sulfite_declaration when false', () => {
    const fields = buildExpectedFields({ sulfiteDeclaration: false }, 'wine')
    expect(fields.has('sulfite_declaration')).toBe(false)
  })

  it('filters out empty string values', () => {
    const fields = buildExpectedFields(
      { brandName: '', fancifulName: '  ' },
      'distilled_spirits',
    )
    expect(fields.has('brand_name')).toBe(false)
    expect(fields.has('fanciful_name')).toBe(false)
  })

  it('trims whitespace from values', () => {
    const fields = buildExpectedFields(
      { brandName: '  Old Tom  ' },
      'distilled_spirits',
    )
    expect(fields.get('brand_name')).toBe('Old Tom')
  })

  it('includes wine-specific mandatory fields', () => {
    const fields = buildExpectedFields(
      {
        brandName: 'Napa Reserve',
        grapeVarietal: 'Cabernet Sauvignon',
        appellationOfOrigin: 'Napa Valley',
      },
      'wine',
    )
    expect(fields.get('grape_varietal')).toBe('Cabernet Sauvignon')
    expect(fields.get('appellation_of_origin')).toBe('Napa Valley')
  })

  it('ignores non-string values other than sulfiteDeclaration', () => {
    const fields = buildExpectedFields(
      { brandName: 42, classType: null },
      'distilled_spirits',
    )
    expect(fields.has('brand_name')).toBe(false)
    expect(fields.has('class_type')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// determineOverallStatus
// ---------------------------------------------------------------------------

describe('determineOverallStatus', () => {
  const allMatch = (fields: string[]) =>
    fields.map((f) => ({ fieldName: f, status: 'match' as const }))

  it('returns approved when all fields match', () => {
    const items = allMatch(['brand_name', 'health_warning', 'alcohol_content'])
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('approved')
    expect(result.deadlineDays).toBeNull()
  })

  it('returns rejected when health_warning has a mismatch', () => {
    const items = [
      { fieldName: 'brand_name', status: 'match' as const },
      { fieldName: 'health_warning', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('rejected')
    expect(result.deadlineDays).toBeNull()
  })

  it('returns rejected when health_warning is not_found on a mandatory type', () => {
    const items = [
      { fieldName: 'brand_name', status: 'match' as const },
      { fieldName: 'health_warning', status: 'not_found' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('rejected')
  })

  it('returns needs_correction when a mandatory non-rejection field mismatches', () => {
    const items = [
      { fieldName: 'health_warning', status: 'match' as const },
      { fieldName: 'alcohol_content', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('needs_correction')
    expect(result.deadlineDays).toBe(CORRECTION_DEADLINE_DAYS)
  })

  it('returns conditionally_approved for minor discrepancy fields', () => {
    const items = [
      { fieldName: 'health_warning', status: 'match' as const },
      { fieldName: 'brand_name', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('conditionally_approved')
    expect(result.deadlineDays).toBe(CONDITIONAL_DEADLINE_DAYS)
  })

  it('returns rejected for an invalid container size', () => {
    const items = allMatch(['brand_name', 'health_warning'])
    const result = determineOverallStatus(items, 'distilled_spirits', 999)
    expect(result.status).toBe('rejected')
    expect(result.deadlineDays).toBeNull()
  })

  it('returns approved for a valid container size with all matches', () => {
    const items = allMatch(['brand_name', 'health_warning'])
    const result = determineOverallStatus(items, 'distilled_spirits', 750)
    expect(result.status).toBe('approved')
  })

  it('allows any container size for malt_beverage (no restrictions)', () => {
    const items = allMatch(['brand_name', 'health_warning'])
    const result = determineOverallStatus(items, 'malt_beverage', 999)
    expect(result.status).toBe('approved')
  })

  it('prioritizes rejection over needs_correction', () => {
    const items = [
      { fieldName: 'health_warning', status: 'mismatch' as const },
      { fieldName: 'alcohol_content', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('rejected')
  })

  it('prioritizes needs_correction over conditionally_approved', () => {
    const items = [
      { fieldName: 'health_warning', status: 'match' as const },
      { fieldName: 'alcohol_content', status: 'mismatch' as const },
      { fieldName: 'fanciful_name', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('needs_correction')
  })

  it('treats optional field mismatch as minor discrepancy', () => {
    const items = [
      { fieldName: 'health_warning', status: 'match' as const },
      { fieldName: 'country_of_origin', status: 'mismatch' as const },
    ]
    const result = determineOverallStatus(items, 'distilled_spirits')
    expect(result.status).toBe('conditionally_approved')
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('MINOR_DISCREPANCY_FIELDS contains expected field names', () => {
    expect(MINOR_DISCREPANCY_FIELDS.has('brand_name')).toBe(true)
    expect(MINOR_DISCREPANCY_FIELDS.has('fanciful_name')).toBe(true)
    expect(MINOR_DISCREPANCY_FIELDS.has('appellation_of_origin')).toBe(true)
    expect(MINOR_DISCREPANCY_FIELDS.has('grape_varietal')).toBe(true)
  })

  it('REJECTION_FIELDS contains health_warning', () => {
    expect(REJECTION_FIELDS.has('health_warning')).toBe(true)
  })

  it('deadline day constants are correct', () => {
    expect(CONDITIONAL_DEADLINE_DAYS).toBe(7)
    expect(CORRECTION_DEADLINE_DAYS).toBe(30)
  })
})
