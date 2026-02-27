import { describe, it, expect } from 'vitest'

import { parseCsvFile } from './CsvParser'

function makeFile(content: string, name = 'test.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

const VALID_CSV = `beverage_type,container_size_ml,brand_name,images
distilled_spirits,750,Old Heritage Reserve,front.jpg;back.jpg
wine,750,Emerald Hill,wine-front.jpg
malt_beverage,355,Mountain Ridge,beer-label.jpg`

describe('parseCsvFile', () => {
  it('parses a valid CSV with 3 rows', async () => {
    const result = await parseCsvFile(makeFile(VALID_CSV))
    expect(result.parseErrors).toEqual([])
    expect(result.validCount).toBe(3)
    expect(result.invalidCount).toBe(0)
    expect(result.rows).toHaveLength(3)
  })

  it('extracts image filenames correctly', async () => {
    const result = await parseCsvFile(makeFile(VALID_CSV))
    expect(result.rows[0].imageFilenames).toEqual(['front.jpg', 'back.jpg'])
    expect(result.rows[1].imageFilenames).toEqual(['wine-front.jpg'])
    expect(result.rows[2].imageFilenames).toEqual(['beer-label.jpg'])
  })

  it('reports validation errors for invalid rows', async () => {
    const csv = `beverage_type,container_size_ml,brand_name,images
invalid_type,750,Test Brand,front.jpg
wine,-1,Another Brand,back.jpg
distilled_spirits,750,,label.jpg`

    const result = await parseCsvFile(makeFile(csv))
    expect(result.invalidCount).toBe(3)
    expect(result.validCount).toBe(0)
    expect(result.rows[0].errors.length).toBeGreaterThan(0)
    expect(result.rows[1].errors.length).toBeGreaterThan(0)
    expect(result.rows[2].errors.length).toBeGreaterThan(0)
  })

  it('handles mixed valid and invalid rows', async () => {
    const csv = `beverage_type,container_size_ml,brand_name,images
distilled_spirits,750,Good Brand,front.jpg
bad_type,0,,`

    const result = await parseCsvFile(makeFile(csv))
    expect(result.validCount).toBe(1)
    expect(result.invalidCount).toBe(1)
    expect(result.rows).toHaveLength(2)
  })

  it('detects duplicate image filenames across rows', async () => {
    const csv = `beverage_type,container_size_ml,brand_name,images
distilled_spirits,750,Brand A,shared.jpg;back-a.jpg
wine,750,Brand B,shared.jpg;back-b.jpg`

    const result = await parseCsvFile(makeFile(csv))
    expect(result.duplicateImages).toContain('shared.jpg')
    // Both rows are still valid — duplicates are a warning, not an error
    expect(result.validCount).toBe(2)
  })

  it('rejects CSV exceeding max batch size', async () => {
    const header = 'beverage_type,container_size_ml,brand_name,images'
    const rows = Array.from(
      { length: 51 },
      (_, i) => `distilled_spirits,750,Brand ${i},img-${i}.jpg`,
    )
    const csv = [header, ...rows].join('\n')

    const result = await parseCsvFile(makeFile(csv))
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toContain('51')
    expect(result.parseErrors[0]).toContain('50')
    expect(result.rows).toHaveLength(0)
  })

  it('handles empty CSV', async () => {
    const result = await parseCsvFile(makeFile(''))
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.validCount).toBe(0)
  })

  it('handles CSV with only headers', async () => {
    const csv = 'beverage_type,container_size_ml,brand_name,images'
    const result = await parseCsvFile(makeFile(csv))
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.validCount).toBe(0)
  })

  it('trims header whitespace', async () => {
    const csv = ` beverage_type , container_size_ml , brand_name , images
distilled_spirits,750,Test,front.jpg`

    const result = await parseCsvFile(makeFile(csv))
    expect(result.validCount).toBe(1)
  })

  it('skips empty lines', async () => {
    const csv = `beverage_type,container_size_ml,brand_name,images

distilled_spirits,750,Test,front.jpg

wine,750,Test2,back.jpg
`

    const result = await parseCsvFile(makeFile(csv))
    expect(result.validCount).toBe(2)
    expect(result.rows).toHaveLength(2)
  })

  it('preserves row indices', async () => {
    const result = await parseCsvFile(makeFile(VALID_CSV))
    expect(result.rows[0].index).toBe(0)
    expect(result.rows[1].index).toBe(1)
    expect(result.rows[2].index).toBe(2)
  })
})
