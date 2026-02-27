import { CSV_COLUMNS } from '@/lib/validators/csv-row-schema'

// Example row with placeholder values so it's obvious this isn't real data
const EXAMPLE_ROW: Record<string, string> = {
  beverage_type: 'wine',
  container_size_ml: '750',
  brand_name: 'Example Winery',
  images: 'example-front.jpg;example-back.jpg',
  fanciful_name: 'Reserve Chardonnay',
  class_type: 'Table Wine',
  alcohol_content: '13.5% Alc. by Vol.',
  net_contents: '750 mL',
  grape_varietal: 'Chardonnay',
  appellation_of_origin: 'Napa Valley',
  vintage_year: '2023',
  sulfite_declaration: 'true',
  qualifying_phrase: 'Produced and Bottled by',
  country_of_origin: 'United States',
}

export function generateCsvTemplate(): string {
  const header = CSV_COLUMNS.join(',')
  const row = CSV_COLUMNS.map((col) => EXAMPLE_ROW[col] ?? '').join(',')
  return `${header}\n${row}`
}

export function downloadCsvTemplate() {
  const csv = generateCsvTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batch-upload-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
