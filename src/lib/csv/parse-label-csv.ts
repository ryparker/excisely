import { z } from 'zod'

// ---------------------------------------------------------------------------
// Column Mapping
// ---------------------------------------------------------------------------

/**
 * Maps CSV column headers (case-insensitive, normalized) to the snake_case
 * field names used internally. Supports common variations of TTB terminology.
 */
const COLUMN_ALIASES: Record<string, string> = {
  // Core fields
  brand_name: 'brand_name',
  'brand name': 'brand_name',
  brandname: 'brand_name',
  brand: 'brand_name',

  fanciful_name: 'fanciful_name',
  'fanciful name': 'fanciful_name',
  fancifulname: 'fanciful_name',

  class_type: 'class_type',
  'class type': 'class_type',
  'class/type': 'class_type',
  classtype: 'class_type',

  alcohol_content: 'alcohol_content',
  'alcohol content': 'alcohol_content',
  alcoholcontent: 'alcohol_content',
  abv: 'alcohol_content',

  net_contents: 'net_contents',
  'net contents': 'net_contents',
  netcontents: 'net_contents',

  name_and_address: 'name_and_address',
  'name and address': 'name_and_address',
  nameandaddress: 'name_and_address',

  qualifying_phrase: 'qualifying_phrase',
  'qualifying phrase': 'qualifying_phrase',
  qualifyingphrase: 'qualifying_phrase',

  country_of_origin: 'country_of_origin',
  'country of origin': 'country_of_origin',
  countryoforigin: 'country_of_origin',
  country: 'country_of_origin',

  // Wine-specific
  grape_varietal: 'grape_varietal',
  'grape varietal': 'grape_varietal',
  grapevarietal: 'grape_varietal',
  varietal: 'grape_varietal',
  grape: 'grape_varietal',

  appellation_of_origin: 'appellation_of_origin',
  'appellation of origin': 'appellation_of_origin',
  appellationoforigin: 'appellation_of_origin',
  appellation: 'appellation_of_origin',

  vintage_year: 'vintage_year',
  'vintage year': 'vintage_year',
  vintageyear: 'vintage_year',
  vintage: 'vintage_year',

  // Spirits-specific
  age_statement: 'age_statement',
  'age statement': 'age_statement',
  agestatement: 'age_statement',
  age: 'age_statement',

  state_of_distillation: 'state_of_distillation',
  'state of distillation': 'state_of_distillation',
  stateofdistillation: 'state_of_distillation',

  // Metadata
  serial_number: 'serial_number',
  'serial number': 'serial_number',
  serialnumber: 'serial_number',

  beverage_type: 'beverage_type',
  'beverage type': 'beverage_type',
  beveragetype: 'beverage_type',
  'type of product': 'beverage_type',

  container_size_ml: 'container_size_ml',
  'container size': 'container_size_ml',
  'container size ml': 'container_size_ml',
  containersizeml: 'container_size_ml',
  size: 'container_size_ml',

  class_type_code: 'class_type_code',
  'class type code': 'class_type_code',
  'class/type code': 'class_type_code',
  classtypecode: 'class_type_code',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedLabelRow {
  rowNumber: number
  fields: Record<string, string>
}

export interface CsvParseError {
  rowNumber: number
  message: string
}

export interface CsvParseResult {
  rows: ParsedLabelRow[]
  errors: CsvParseError[]
  unmappedColumns: string[]
}

// ---------------------------------------------------------------------------
// Row-level validation
// ---------------------------------------------------------------------------

const rowSchema = z.object({
  brand_name: z.string().min(1, 'Brand Name is required'),
  beverage_type: z
    .enum(['distilled_spirits', 'wine', 'malt_beverage'])
    .or(z.string().min(1, 'Beverage Type is required')),
  container_size_ml: z.string().min(1, 'Container Size (mL) is required'),
})

/** Normalizes common beverage type variations to our enum values. */
function normalizeBeverageType(raw: string): string {
  const lower = raw.toLowerCase().trim()
  const mapping: Record<string, string> = {
    'distilled spirits': 'distilled_spirits',
    distilled_spirits: 'distilled_spirits',
    spirits: 'distilled_spirits',
    wine: 'wine',
    'malt beverage': 'malt_beverage',
    'malt beverages': 'malt_beverage',
    malt_beverage: 'malt_beverage',
    beer: 'malt_beverage',
  }
  return mapping[lower] ?? raw
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses a CSV string into labeled rows. Uses a lightweight built-in parser
 * that handles quoted fields, escaped quotes, and CRLF line endings.
 *
 * Returns parsed rows with field values mapped to snake_case field names,
 * plus any validation errors and unmapped column headers.
 */
export function parseLabelCsv(csvText: string): CsvParseResult {
  const rows: ParsedLabelRow[] = []
  const errors: CsvParseError[] = []

  const lines = splitCsvRows(csvText)
  if (lines.length === 0) {
    errors.push({ rowNumber: 0, message: 'CSV file is empty' })
    return { rows, errors, unmappedColumns: [] }
  }

  // Parse header row
  const headerCells = parseCsvLine(lines[0])
  const columnMap: Array<{ index: number; fieldName: string }> = []
  const unmappedColumns: string[] = []

  for (let i = 0; i < headerCells.length; i++) {
    const raw = headerCells[i].trim()
    const normalized = raw
      .toLowerCase()
      .replace(/[_\s/]+/g, ' ')
      .trim()
    const fieldName =
      COLUMN_ALIASES[normalized] ??
      COLUMN_ALIASES[raw.toLowerCase().trim()] ??
      null

    if (fieldName) {
      columnMap.push({ index: i, fieldName })
    } else if (raw !== '') {
      unmappedColumns.push(raw)
    }
  }

  if (columnMap.length === 0) {
    errors.push({
      rowNumber: 1,
      message:
        'No recognized column headers found. Expected headers like "Brand Name", "Beverage Type", "Container Size ML".',
    })
    return { rows, errors, unmappedColumns }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue

    const cells = parseCsvLine(line)
    const rowNumber = i + 1
    const fields: Record<string, string> = {}

    for (const { index, fieldName } of columnMap) {
      const value = (cells[index] ?? '').trim()
      if (value !== '') {
        fields[fieldName] =
          fieldName === 'beverage_type' ? normalizeBeverageType(value) : value
      }
    }

    // Validate required fields
    const validation = rowSchema.safeParse(fields)
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        errors.push({
          rowNumber,
          message: `${issue.path.join('.')}: ${issue.message}`,
        })
      }
      continue
    }

    rows.push({ rowNumber, fields })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({
      rowNumber: 0,
      message: 'No data rows found in CSV file',
    })
  }

  return { rows, errors, unmappedColumns }
}

// ---------------------------------------------------------------------------
// Low-level CSV tokenizer
// ---------------------------------------------------------------------------

/**
 * Splits CSV text into individual rows, respecting quoted fields that may
 * contain newlines.
 */
function splitCsvRows(text: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      rows.push(current)
      current = ''
      // Skip \r\n pair
      if (ch === '\r' && text[i + 1] === '\n') {
        i++
      }
    } else {
      current += ch
    }
  }

  if (current.trim() !== '') {
    rows.push(current)
  }

  return rows
}

/**
 * Parses a single CSV line into cell values, handling quoted fields and
 * escaped double quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  cells.push(current)
  return cells
}
