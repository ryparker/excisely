import { describe, it, expect } from 'vitest'

import {
  csvRowSchema,
  csvRowToLabelInput,
  MAX_BATCH_SIZE,
} from './csv-row-schema'

describe('csvRowSchema', () => {
  const validRow = {
    beverage_type: 'distilled_spirits',
    container_size_ml: '750',
    brand_name: 'Old Heritage Reserve',
    images: 'front.jpg;back.jpg',
  }

  it('parses a valid minimal row', () => {
    const result = csvRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.beverage_type).toBe('distilled_spirits')
      expect(result.data.container_size_ml).toBe(750)
      expect(result.data.brand_name).toBe('Old Heritage Reserve')
      expect(result.data.images).toEqual(['front.jpg', 'back.jpg'])
    }
  })

  it('parses all beverage types', () => {
    for (const type of ['distilled_spirits', 'wine', 'malt_beverage']) {
      const result = csvRowSchema.safeParse({
        ...validRow,
        beverage_type: type,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid beverage type', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      beverage_type: 'soda',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive container size', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      container_size_ml: '0',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer container size', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      container_size_ml: '750.5',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty brand name', () => {
    const result = csvRowSchema.safeParse({ ...validRow, brand_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty images column', () => {
    const result = csvRowSchema.safeParse({ ...validRow, images: '' })
    expect(result.success).toBe(false)
  })

  it('handles single image filename', () => {
    const result = csvRowSchema.safeParse({ ...validRow, images: 'front.jpg' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toEqual(['front.jpg'])
    }
  })

  it('trims whitespace around semicolons in images', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      images: ' front.jpg ; back.jpg ; side.jpg ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toEqual(['front.jpg', 'back.jpg', 'side.jpg'])
    }
  })

  it('filters empty segments from images', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      images: 'front.jpg;;back.jpg;',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toEqual(['front.jpg', 'back.jpg'])
    }
  })

  it('parses sulfite_declaration as boolean', () => {
    const trueResult = csvRowSchema.safeParse({
      ...validRow,
      sulfite_declaration: 'true',
    })
    expect(trueResult.success).toBe(true)
    if (trueResult.success) {
      expect(trueResult.data.sulfite_declaration).toBe(true)
    }

    const falseResult = csvRowSchema.safeParse({
      ...validRow,
      sulfite_declaration: 'false',
    })
    expect(falseResult.success).toBe(true)
    if (falseResult.success) {
      expect(falseResult.data.sulfite_declaration).toBe(false)
    }
  })

  it('treats empty sulfite_declaration as undefined', () => {
    const result = csvRowSchema.safeParse({
      ...validRow,
      sulfite_declaration: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sulfite_declaration).toBeUndefined()
    }
  })

  it('defaults optional fields to empty string', () => {
    const result = csvRowSchema.safeParse(validRow)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.serial_number).toBe('')
      expect(result.data.fanciful_name).toBe('')
      expect(result.data.class_type).toBe('')
    }
  })

  it('parses a fully-populated row', () => {
    const fullRow = {
      ...validRow,
      serial_number: '24001234',
      fanciful_name: 'Single Barrel',
      class_type: 'Bourbon Whiskey',
      class_type_code: '641',
      alcohol_content: '47% Alc. by Vol.',
      net_contents: '750 mL',
      name_and_address: 'Distillery, Louisville, KY',
      qualifying_phrase: 'Distilled by',
      country_of_origin: 'United States',
      age_statement: 'Aged 8 Years',
      state_of_distillation: 'Kentucky',
    }
    const result = csvRowSchema.safeParse(fullRow)
    expect(result.success).toBe(true)
  })
})

describe('csvRowToLabelInput', () => {
  it('transforms a CSV row to ValidateLabelInput', () => {
    const row = csvRowSchema.parse({
      beverage_type: 'wine',
      container_size_ml: '750',
      brand_name: 'Emerald Hill',
      images: 'front.jpg',
      grape_varietal: 'Sauvignon Blanc',
      appellation_of_origin: 'Napa Valley',
      vintage_year: '2022',
      sulfite_declaration: 'true',
    })

    const input = csvRowToLabelInput(row)
    expect(input.beverageType).toBe('wine')
    expect(input.containerSizeMl).toBe(750)
    expect(input.brandName).toBe('Emerald Hill')
    expect(input.grapeVarietal).toBe('Sauvignon Blanc')
    expect(input.appellationOfOrigin).toBe('Napa Valley')
    expect(input.vintageYear).toBe('2022')
    expect(input.sulfiteDeclaration).toBe(true)
  })

  it('auto-fills healthWarning with regulatory text', () => {
    const row = csvRowSchema.parse({
      beverage_type: 'distilled_spirits',
      container_size_ml: '750',
      brand_name: 'Test Brand',
      images: 'front.jpg',
    })

    const input = csvRowToLabelInput(row)
    expect(input.healthWarning).toMatch(/^GOVERNMENT WARNING/)
  })

  it('converts empty optional strings to undefined', () => {
    const row = csvRowSchema.parse({
      beverage_type: 'malt_beverage',
      container_size_ml: '355',
      brand_name: 'Test Brew',
      images: 'label.jpg',
    })

    const input = csvRowToLabelInput(row)
    expect(input.fancifulName).toBeUndefined()
    expect(input.classType).toBeUndefined()
    expect(input.alcoholContent).toBeUndefined()
    expect(input.ageStatement).toBeUndefined()
  })
})

describe('MAX_BATCH_SIZE', () => {
  it('is 50', () => {
    expect(MAX_BATCH_SIZE).toBe(50)
  })
})
