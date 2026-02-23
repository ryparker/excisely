import {
  BEVERAGE_TYPES,
  getMandatoryFields,
  getHealthWarningMinTypeSizeMm,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'

describe('BEVERAGE_TYPES', () => {
  it('defines three beverage types', () => {
    const types = Object.keys(BEVERAGE_TYPES)
    expect(types).toEqual(['distilled_spirits', 'wine', 'malt_beverage'])
  })
})

describe('getMandatoryFields', () => {
  it('returns 7 mandatory fields for distilled spirits', () => {
    const fields = getMandatoryFields('distilled_spirits')
    expect(fields).toHaveLength(7)
    expect(fields).toContain('brand_name')
    expect(fields).toContain('health_warning')
    expect(fields).toContain('qualifying_phrase')
  })

  it('returns 10 mandatory fields for wine', () => {
    const fields = getMandatoryFields('wine')
    expect(fields).toHaveLength(10)
    expect(fields).toContain('grape_varietal')
    expect(fields).toContain('appellation_of_origin')
    expect(fields).toContain('sulfite_declaration')
  })

  it('returns 6 mandatory fields for malt beverages', () => {
    const fields = getMandatoryFields('malt_beverage')
    expect(fields).toHaveLength(6)
    expect(fields).not.toContain('alcohol_content')
  })

  it('all types share brand_name, health_warning, and name_and_address', () => {
    const types: BeverageType[] = ['distilled_spirits', 'wine', 'malt_beverage']
    for (const type of types) {
      const fields = getMandatoryFields(type)
      expect(fields).toContain('brand_name')
      expect(fields).toContain('health_warning')
      expect(fields).toContain('name_and_address')
    }
  })
})

describe('isValidSize', () => {
  it('returns true for a valid distilled spirits size', () => {
    expect(isValidSize('distilled_spirits', 750)).toBe(true)
  })

  it('returns false for an invalid distilled spirits size', () => {
    expect(isValidSize('distilled_spirits', 999)).toBe(false)
  })

  it('returns true for a valid wine size', () => {
    expect(isValidSize('wine', 750)).toBe(true)
  })

  it('returns false for an invalid wine size', () => {
    expect(isValidSize('wine', 355)).toBe(false)
  })

  it('returns true for any malt beverage size (no restrictions)', () => {
    expect(isValidSize('malt_beverage', 1)).toBe(true)
    expect(isValidSize('malt_beverage', 99999)).toBe(true)
  })
})

describe('getHealthWarningMinTypeSizeMm', () => {
  it('returns 1mm for containers <= 237 mL', () => {
    expect(getHealthWarningMinTypeSizeMm(50)).toBe(1)
    expect(getHealthWarningMinTypeSizeMm(237)).toBe(1)
  })

  it('returns 2mm for containers > 237 mL and <= 3000 mL', () => {
    expect(getHealthWarningMinTypeSizeMm(238)).toBe(2)
    expect(getHealthWarningMinTypeSizeMm(750)).toBe(2)
    expect(getHealthWarningMinTypeSizeMm(3000)).toBe(2)
  })

  it('returns 3mm for containers > 3000 mL', () => {
    expect(getHealthWarningMinTypeSizeMm(3001)).toBe(3)
    expect(getHealthWarningMinTypeSizeMm(5000)).toBe(3)
  })
})
