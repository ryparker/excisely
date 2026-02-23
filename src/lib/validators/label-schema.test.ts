import { validateLabelSchema } from '@/lib/validators/label-schema'

describe('validateLabelSchema', () => {
  const validInput = {
    beverageType: 'distilled_spirits' as const,
    containerSizeMl: 750,
    brandName: 'Old Tom Reserve',
  }

  it('accepts valid minimal input', () => {
    const result = validateLabelSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts input with all optional fields', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      classTypeCode: '140',
      serialNumber: 'SN12345',
      fancifulName: 'Heritage Collection',
      classType: 'Bourbon Whisky',
      alcoholContent: '45%',
      netContents: '750 mL',
      healthWarning: 'GOVERNMENT WARNING...',
      nameAndAddress: 'Old Tom Distillery, KY',
      qualifyingPhrase: 'Distilled by',
      countryOfOrigin: 'United States',
      ageStatement: '12 Years',
      stateOfDistillation: 'Kentucky',
      applicantId: 'abc123',
      batchId: 'batch456',
      priorLabelId: 'prior789',
    })
    expect(result.success).toBe(true)
  })

  it('fails when beverageType is missing', () => {
    const result = validateLabelSchema.safeParse({
      containerSizeMl: 750,
      brandName: 'Old Tom Reserve',
    })
    expect(result.success).toBe(false)
  })

  it('fails when containerSizeMl is missing', () => {
    const result = validateLabelSchema.safeParse({
      beverageType: 'wine',
      brandName: 'Test Wine',
    })
    expect(result.success).toBe(false)
  })

  it('fails when brandName is empty', () => {
    const result = validateLabelSchema.safeParse({
      beverageType: 'wine',
      containerSizeMl: 750,
      brandName: '',
    })
    expect(result.success).toBe(false)
  })

  it('fails for invalid beverageType enum', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      beverageType: 'kombucha',
    })
    expect(result.success).toBe(false)
  })

  it('fails for negative containerSizeMl', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      containerSizeMl: -1,
    })
    expect(result.success).toBe(false)
  })

  it('fails for non-integer containerSizeMl', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      containerSizeMl: 750.5,
    })
    expect(result.success).toBe(false)
  })

  it('shows human-friendly error for NaN containerSizeMl', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      containerSizeMl: NaN,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = result.error.issues[0]?.message
      expect(message).toBe('Enter a valid number')
    }
  })

  it('shows human-friendly error for missing beverageType', () => {
    const result = validateLabelSchema.safeParse({
      containerSizeMl: 750,
      brandName: 'Test',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = result.error.issues[0]?.message
      expect(message).toBe('Select a beverage type')
    }
  })

  it('trims whitespace from string fields', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      brandName: '  Old Tom Reserve  ',
      fancifulName: '  Heritage Collection  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandName).toBe('Old Tom Reserve')
      expect(result.data.fancifulName).toBe('Heritage Collection')
    }
  })

  it('handles sulfiteDeclaration as boolean', () => {
    const result = validateLabelSchema.safeParse({
      ...validInput,
      beverageType: 'wine',
      sulfiteDeclaration: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sulfiteDeclaration).toBe(true)
    }
  })
})
