import Papa from 'papaparse'

import {
  csvRowSchema,
  type CsvRowData,
  MAX_BATCH_SIZE,
} from '@/lib/validators/csv-row-schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvRowError {
  row: number
  field: string
  message: string
}

export interface CsvParseResult {
  rows: Array<{
    index: number
    data: CsvRowData
    errors: CsvRowError[]
    imageFilenames: string[]
  }>
  validCount: number
  invalidCount: number
  parseErrors: string[]
  duplicateImages: string[]
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        resolve(processParseResults(results))
      },
      error: (error) => {
        resolve({
          rows: [],
          validCount: 0,
          invalidCount: 0,
          parseErrors: [error.message],
          duplicateImages: [],
        })
      },
    })
  })
}

function processParseResults(
  results: Papa.ParseResult<Record<string, string>>,
): CsvParseResult {
  const parseErrors: string[] = []

  // Check for Papa-level parse errors
  if (results.errors.length > 0) {
    for (const err of results.errors) {
      if (err.type === 'Delimiter' || err.type === 'FieldMismatch') {
        parseErrors.push(
          err.row !== undefined
            ? `Row ${err.row + 1}: ${err.message}`
            : err.message,
        )
      }
    }
  }

  // Enforce max batch size
  if (results.data.length > MAX_BATCH_SIZE) {
    parseErrors.push(
      `CSV contains ${results.data.length} rows. Maximum is ${MAX_BATCH_SIZE}.`,
    )
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      parseErrors,
      duplicateImages: [],
    }
  }

  if (results.data.length === 0) {
    parseErrors.push('CSV file is empty or contains no data rows.')
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      parseErrors,
      duplicateImages: [],
    }
  }

  // Validate each row
  const rows: CsvParseResult['rows'] = []
  let validCount = 0
  let invalidCount = 0
  const allImageFilenames = new Map<string, number[]>()

  for (let i = 0; i < results.data.length; i++) {
    const raw = results.data[i]
    const rowNumber = i + 1
    const errors: CsvRowError[] = []

    const parsed = csvRowSchema.safeParse(raw)

    if (parsed.success) {
      const imageFilenames = parsed.data.images

      // Track image filenames for duplicate detection
      for (const filename of imageFilenames) {
        const existing = allImageFilenames.get(filename) ?? []
        existing.push(rowNumber)
        allImageFilenames.set(filename, existing)
      }

      rows.push({
        index: i,
        data: parsed.data,
        errors,
        imageFilenames,
      })
      validCount++
    } else {
      // Collect Zod validation errors
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.join('.') || 'unknown',
          message: issue.message,
        })
      }

      // Still extract what we can for display
      const imageFilenames = (raw.images ?? '')
        .split(';')
        .map((s: string) => s.trim())
        .filter(Boolean)

      rows.push({
        index: i,
        data: null as unknown as CsvRowData,
        errors,
        imageFilenames,
      })
      invalidCount++
    }
  }

  // Find duplicate images (used in multiple rows)
  const duplicateImages: string[] = []
  for (const [filename, rowNumbers] of allImageFilenames) {
    if (rowNumbers.length > 1) {
      duplicateImages.push(filename)
    }
  }

  return { rows, validCount, invalidCount, parseErrors, duplicateImages }
}
