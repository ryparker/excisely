import { z } from 'zod'

import { HEALTH_WARNING_FULL } from '@/config/health-warning'
import type { ValidateLabelInput } from './label-schema'

// ---------------------------------------------------------------------------
// CSV column schema
// ---------------------------------------------------------------------------

const beverageTypeEnum = z.enum(
  ['distilled_spirits', 'wine', 'malt_beverage'],
  { message: 'Must be distilled_spirits, wine, or malt_beverage' },
)

export const csvRowSchema = z.object({
  beverage_type: beverageTypeEnum,
  container_size_ml: z
    .string()
    .min(1, 'Required')
    .transform((v) => Number(v))
    .pipe(z.number().int('Must be a whole number').positive('Must be > 0')),
  brand_name: z.string().min(1, 'Brand name is required'),
  images: z
    .string()
    .min(1, 'At least one image filename is required')
    .transform((v) =>
      v
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).min(1, 'At least one image is required')),
  serial_number: z.string().trim().optional().default(''),
  fanciful_name: z.string().trim().optional().default(''),
  class_type: z.string().trim().optional().default(''),
  class_type_code: z.string().trim().optional().default(''),
  alcohol_content: z.string().trim().optional().default(''),
  net_contents: z.string().trim().optional().default(''),
  name_and_address: z.string().trim().optional().default(''),
  qualifying_phrase: z.string().trim().optional().default(''),
  country_of_origin: z.string().trim().optional().default(''),
  grape_varietal: z.string().trim().optional().default(''),
  appellation_of_origin: z.string().trim().optional().default(''),
  vintage_year: z.string().trim().optional().default(''),
  sulfite_declaration: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((v) => {
      if (v.toLowerCase() === 'true') return true
      if (v.toLowerCase() === 'false') return false
      return undefined
    }),
  age_statement: z.string().trim().optional().default(''),
  state_of_distillation: z.string().trim().optional().default(''),
})

export type CsvRowData = z.infer<typeof csvRowSchema>

// ---------------------------------------------------------------------------
// Transform: CSV row → ValidateLabelInput
// ---------------------------------------------------------------------------

export function csvRowToLabelInput(row: CsvRowData): ValidateLabelInput {
  return {
    beverageType: row.beverage_type,
    containerSizeMl: row.container_size_ml,
    brandName: row.brand_name,
    serialNumber: row.serial_number || undefined,
    fancifulName: row.fanciful_name || undefined,
    classType: row.class_type || undefined,
    classTypeCode: row.class_type_code || undefined,
    alcoholContent: row.alcohol_content || undefined,
    netContents: row.net_contents || undefined,
    healthWarning: HEALTH_WARNING_FULL,
    nameAndAddress: row.name_and_address || undefined,
    qualifyingPhrase: row.qualifying_phrase || undefined,
    countryOfOrigin: row.country_of_origin || undefined,
    grapeVarietal: row.grape_varietal || undefined,
    appellationOfOrigin: row.appellation_of_origin || undefined,
    vintageYear: row.vintage_year || undefined,
    sulfiteDeclaration: row.sulfite_declaration,
    ageStatement: row.age_statement || undefined,
    stateOfDistillation: row.state_of_distillation || undefined,
  }
}

// ---------------------------------------------------------------------------
// CSV column names (for template generation and validation)
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = [
  'beverage_type',
  'container_size_ml',
  'brand_name',
  'images',
  'serial_number',
  'fanciful_name',
  'class_type',
  'class_type_code',
  'alcohol_content',
  'net_contents',
  'name_and_address',
  'qualifying_phrase',
  'country_of_origin',
  'grape_varietal',
  'appellation_of_origin',
  'vintage_year',
  'sulfite_declaration',
  'age_statement',
  'state_of_distillation',
] as const

export const MAX_BATCH_SIZE = 50
