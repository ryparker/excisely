import { FIELD_DESCRIPTIONS, getAllFieldNames } from '@/lib/ai/prompts'

describe('FIELD_DESCRIPTIONS', () => {
  it('has descriptions for all common TTB fields', () => {
    const expectedFields = [
      'brand_name',
      'fanciful_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
      'country_of_origin',
      'grape_varietal',
      'appellation_of_origin',
      'vintage_year',
      'sulfite_declaration',
      'age_statement',
      'state_of_distillation',
      'standards_of_fill',
    ]

    for (const field of expectedFields) {
      expect(FIELD_DESCRIPTIONS[field]).toBeDefined()
      expect(FIELD_DESCRIPTIONS[field].length).toBeGreaterThan(10)
    }
  })
})

describe('getAllFieldNames', () => {
  it('returns all unique field names across all beverage types', () => {
    const fields = getAllFieldNames()
    expect(fields.length).toBeGreaterThan(10)
    expect(fields).toContain('brand_name')
    expect(fields).toContain('health_warning')
    expect(fields).toContain('grape_varietal')
    expect(fields).toContain('age_statement')
  })

  it('does not contain duplicates', () => {
    const fields = getAllFieldNames()
    const unique = new Set(fields)
    expect(unique.size).toBe(fields.length)
  })
})
