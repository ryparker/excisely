import { describe, it, expect } from 'vitest'

import { parseLabelCsv } from './parse-label-csv'

describe('parseLabelCsv', () => {
  it('parses a simple CSV with recognized headers', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML,Alcohol Content',
      'Old Tom,distilled_spirits,750,45% Alc./Vol.',
      'Napa Reserve,wine,750,14.5% Alc./Vol.',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].fields.brand_name).toBe('Old Tom')
    expect(result.rows[0].fields.beverage_type).toBe('distilled_spirits')
    expect(result.rows[0].fields.container_size_ml).toBe('750')
    expect(result.rows[0].fields.alcohol_content).toBe('45% Alc./Vol.')
    expect(result.rows[1].fields.brand_name).toBe('Napa Reserve')
    expect(result.rows[1].fields.beverage_type).toBe('wine')
  })

  it('normalizes beverage type values', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML',
      'Test Beer,Beer,355',
      'Test Wine,Wine,750',
      'Test Spirits,Distilled Spirits,750',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].fields.beverage_type).toBe('malt_beverage')
    expect(result.rows[1].fields.beverage_type).toBe('wine')
    expect(result.rows[2].fields.beverage_type).toBe('distilled_spirits')
  })

  it('handles quoted fields with commas', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML,Name and Address',
      '"Maker\'s Mark",distilled_spirits,750,"Beam Suntory, Clermont, KY"',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].fields.brand_name).toBe("Maker's Mark")
    expect(result.rows[0].fields.name_and_address).toBe(
      'Beam Suntory, Clermont, KY',
    )
  })

  it('handles escaped double quotes', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML',
      '"The ""Original"" Brand",wine,750',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].fields.brand_name).toBe('The "Original" Brand')
  })

  it('reports validation errors for missing required fields', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML',
      ',distilled_spirits,750',
      'Test,wine,',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('returns unmapped columns', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML,Custom Column,Notes',
      'Test,wine,750,,some note',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.unmappedColumns).toContain('Custom Column')
    expect(result.unmappedColumns).toContain('Notes')
  })

  it('handles CRLF line endings', () => {
    const csv =
      'Brand Name,Beverage Type,Container Size ML\r\nTest,wine,750\r\n'

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].fields.brand_name).toBe('Test')
  })

  it('handles empty CSV', () => {
    const result = parseLabelCsv('')

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('handles CSV with only headers', () => {
    const csv = 'Brand Name,Beverage Type,Container Size ML'

    const result = parseLabelCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain('No data rows')
  })

  it('maps various column header aliases', () => {
    const csv = [
      'brand,type of product,size,ABV,Varietal,Appellation',
      'Napa Reserve,wine,750,14.5%,Cabernet Sauvignon,Napa Valley',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].fields.brand_name).toBe('Napa Reserve')
    expect(result.rows[0].fields.beverage_type).toBe('wine')
    expect(result.rows[0].fields.container_size_ml).toBe('750')
    expect(result.rows[0].fields.alcohol_content).toBe('14.5%')
    expect(result.rows[0].fields.grape_varietal).toBe('Cabernet Sauvignon')
    expect(result.rows[0].fields.appellation_of_origin).toBe('Napa Valley')
  })

  it('skips empty rows', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML',
      'Test1,wine,750',
      '',
      '',
      'Test2,malt_beverage,355',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
  })

  it('returns correct row numbers', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML',
      'Test1,wine,750',
      'Test2,malt_beverage,355',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.rows[0].rowNumber).toBe(2)
    expect(result.rows[1].rowNumber).toBe(3)
  })

  it('handles wine-specific and spirits-specific fields', () => {
    const csv = [
      'Brand Name,Beverage Type,Container Size ML,Grape Varietal,Vintage Year,Age Statement,State of Distillation',
      'Test Wine,wine,750,Pinot Noir,2022,,',
      'Test Bourbon,distilled_spirits,750,,,Aged 8 Years,Kentucky',
    ].join('\n')

    const result = parseLabelCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)

    expect(result.rows[0].fields.grape_varietal).toBe('Pinot Noir')
    expect(result.rows[0].fields.vintage_year).toBe('2022')

    expect(result.rows[1].fields.age_statement).toBe('Aged 8 Years')
    expect(result.rows[1].fields.state_of_distillation).toBe('Kentucky')
  })
})
