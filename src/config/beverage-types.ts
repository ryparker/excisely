export type BeverageType = 'distilled_spirits' | 'wine' | 'malt_beverage'

export interface BeverageTypeConfig {
  label: string
  mandatoryFields: string[]
  optionalFields: string[]
  validSizesMl: number[] | null
  /** CFR Part number governing this beverage type (4 = Wine, 5 = Spirits, 7 = Malt) */
  cfrPart: number
}

export const BEVERAGE_TYPES: Record<BeverageType, BeverageTypeConfig> = {
  distilled_spirits: {
    label: 'Distilled Spirits',
    cfrPart: 5,
    mandatoryFields: [
      'brand_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
    ],
    optionalFields: [
      'fanciful_name',
      'country_of_origin',
      'age_statement',
      'state_of_distillation',
      'standards_of_fill',
    ],
    validSizesMl: [
      50, 100, 187, 200, 250, 331, 350, 355, 375, 475, 500, 570, 700, 710, 720,
      750, 900, 945, 1000, 1500, 1750, 1800, 2000, 3000, 3750,
    ],
  },
  wine: {
    label: 'Wine',
    cfrPart: 4,
    mandatoryFields: [
      'brand_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
      'sulfite_declaration',
    ],
    optionalFields: [
      'fanciful_name',
      'country_of_origin',
      // Conditionally mandatory: required when varietal name is used as the
      // class/type designation (27 CFR 4.23). Treated as optional here because
      // not all wines use varietal labeling (e.g., "Table Wine", "Red Wine").
      'grape_varietal',
      'appellation_of_origin',
      'vintage_year',
      'standards_of_fill',
    ],
    // Per 27 CFR 4.72 (updated Jan 2025 final rule).
    // Does NOT include 200 or 250 mL (those are spirits-only sizes).
    validSizesMl: [
      50, 100, 180, 187, 300, 330, 360, 375, 473, 500, 550, 568, 600, 620, 700,
      720, 750, 1000, 1500, 1800, 2250, 3000,
    ],
  },
  malt_beverage: {
    label: 'Malt Beverages',
    cfrPart: 7,
    mandatoryFields: [
      'brand_name',
      'class_type',
      'net_contents',
      'health_warning',
      'name_and_address',
      'qualifying_phrase',
    ],
    optionalFields: [
      'fanciful_name',
      'alcohol_content',
      'country_of_origin',
      'standards_of_fill',
    ],
    validSizesMl: null,
  },
}

/**
 * Returns the mandatory field names for a given beverage type.
 */
export function getMandatoryFields(type: BeverageType): string[] {
  return BEVERAGE_TYPES[type].mandatoryFields
}

/**
 * Checks whether a container size is valid for the given beverage type.
 * Returns true if the beverage type has no size restrictions (null)
 * or the size appears in the valid sizes list.
 */
export function isValidSize(type: BeverageType, sizeMl: number): boolean {
  const validSizes = BEVERAGE_TYPES[type].validSizesMl
  if (validSizes === null) return true
  return validSizes.includes(sizeMl)
}

/**
 * Returns the minimum type size in millimeters for the health warning statement
 * based on container size, per 27 CFR 16.22.
 *
 * - Containers ≤237 mL (8 oz): 1 mm
 * - Containers >237 mL to 3000 mL: 2 mm
 * - Containers >3000 mL: 3 mm
 */
export function getHealthWarningMinTypeSizeMm(containerSizeMl: number): number {
  if (containerSizeMl <= 237) return 1
  if (containerSizeMl <= 3000) return 2
  return 3
}
