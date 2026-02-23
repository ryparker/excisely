import {
  CLASS_TYPE_CODES,
  getCodesByBeverageType,
} from '@/config/class-type-codes'

describe('CLASS_TYPE_CODES', () => {
  it('contains codes for all three beverage types', () => {
    const types = new Set(CLASS_TYPE_CODES.map((c) => c.beverageType))
    expect(types).toEqual(
      new Set(['distilled_spirits', 'wine', 'malt_beverage']),
    )
  })

  it('has no duplicate codes', () => {
    const codes = CLASS_TYPE_CODES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('getCodesByBeverageType', () => {
  it('returns only distilled spirits codes', () => {
    const codes = getCodesByBeverageType('distilled_spirits')
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.every((c) => c.beverageType === 'distilled_spirits')).toBe(
      true,
    )
  })

  it('returns only wine codes', () => {
    const codes = getCodesByBeverageType('wine')
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.every((c) => c.beverageType === 'wine')).toBe(true)
  })

  it('returns only malt beverage codes', () => {
    const codes = getCodesByBeverageType('malt_beverage')
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.every((c) => c.beverageType === 'malt_beverage')).toBe(true)
  })

  it('includes known specific codes', () => {
    const spirits = getCodesByBeverageType('distilled_spirits')
    expect(spirits.find((c) => c.code === '101')?.description).toBe(
      'Straight Bourbon Whisky',
    )

    const wines = getCodesByBeverageType('wine')
    expect(wines.find((c) => c.code === '84')?.description).toBe(
      'Sparkling Wine / Champagne',
    )

    const malts = getCodesByBeverageType('malt_beverage')
    expect(malts.find((c) => c.code === '901')?.description).toBe('Beer')
  })

  it('no code overlap between beverage types', () => {
    const spiritCodes = new Set(
      getCodesByBeverageType('distilled_spirits').map((c) => c.code),
    )
    const wineCodes = new Set(getCodesByBeverageType('wine').map((c) => c.code))
    const maltCodes = new Set(
      getCodesByBeverageType('malt_beverage').map((c) => c.code),
    )

    for (const code of spiritCodes) {
      expect(wineCodes.has(code)).toBe(false)
      expect(maltCodes.has(code)).toBe(false)
    }
    for (const code of wineCodes) {
      expect(maltCodes.has(code)).toBe(false)
    }
  })
})
