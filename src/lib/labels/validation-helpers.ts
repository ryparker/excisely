import {
  getMandatoryFields,
  isValidSize,
  type BeverageType,
} from '@/config/beverage-types'
import { HEALTH_WARNING_FULL } from '@/config/health-warning'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabelStatus =
  | 'approved'
  | 'conditionally_approved'
  | 'needs_correction'
  | 'rejected'

export type ValidationItemStatus =
  | 'match'
  | 'mismatch'
  | 'not_found'
  | 'needs_correction'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fields where a mismatch is considered minor — the label can still
 * receive "conditionally approved" status with a 7-day correction window.
 */
export const MINOR_DISCREPANCY_FIELDS = new Set([
  'brand_name',
  'fanciful_name',
  'appellation_of_origin',
  'grape_varietal',
])

/**
 * Fields where a missing or mismatched value triggers immediate rejection.
 */
export const REJECTION_FIELDS = new Set(['health_warning'])

export const CONDITIONAL_DEADLINE_DAYS = 7
export const CORRECTION_DEADLINE_DAYS = 30

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Maps application data fields to the field names used by the AI pipeline
 * and comparison engine, returning key-value pairs for every field that
 * was provided in the application.
 */
export function buildExpectedFields(
  data: Record<string, unknown>,
  beverageType: BeverageType,
): Map<string, string> {
  const fields = new Map<string, string>()

  const mapping: Record<string, string> = {
    brandName: 'brand_name',
    fancifulName: 'fanciful_name',
    classType: 'class_type',
    alcoholContent: 'alcohol_content',
    netContents: 'net_contents',
    healthWarning: 'health_warning',
    nameAndAddress: 'name_and_address',
    qualifyingPhrase: 'qualifying_phrase',
    countryOfOrigin: 'country_of_origin',
    grapeVarietal: 'grape_varietal',
    appellationOfOrigin: 'appellation_of_origin',
    vintageYear: 'vintage_year',
    ageStatement: 'age_statement',
    stateOfDistillation: 'state_of_distillation',
  }

  for (const [camelKey, fieldName] of Object.entries(mapping)) {
    const value = data[camelKey]
    if (typeof value === 'string' && value.trim() !== '') {
      fields.set(fieldName, value.trim())
    }
  }

  // Handle sulfite declaration as a boolean → text
  if (data.sulfiteDeclaration === true) {
    fields.set('sulfite_declaration', 'Contains Sulfites')
  }

  // Always expect health warning for all beverage types
  if (!fields.has('health_warning')) {
    fields.set('health_warning', HEALTH_WARNING_FULL)
  }

  // Only include fields that are mandatory or were explicitly provided
  const mandatory = new Set(getMandatoryFields(beverageType))
  const result = new Map<string, string>()

  for (const [fieldName, value] of fields) {
    result.set(fieldName, value)
  }

  // Add mandatory fields that were not provided — they must still be checked
  for (const fieldName of mandatory) {
    if (!result.has(fieldName)) {
      // For mandatory fields with no expected value, we still need to
      // verify they exist on the label. Use empty string to signal
      // "must be present but no specific value to compare against."
      // However, health_warning always has a known expected value.
      if (fieldName === 'health_warning') {
        result.set(fieldName, HEALTH_WARNING_FULL)
      }
    }
  }

  return result
}

/**
 * Determines the overall label status based on individual field comparison
 * results and container size validity.
 */
export function determineOverallStatus(
  itemStatuses: Array<{ fieldName: string; status: ValidationItemStatus }>,
  beverageType: BeverageType,
  containerSizeMl?: number,
): { status: LabelStatus; deadlineDays: number | null } {
  // Check container size validity first (skipped when not provided, e.g. during review)
  if (
    containerSizeMl !== undefined &&
    !isValidSize(beverageType, containerSizeMl)
  ) {
    return { status: 'rejected', deadlineDays: null }
  }

  const mandatory = new Set(getMandatoryFields(beverageType))

  let hasRejection = false
  let hasSubstantiveMismatch = false
  let hasMinorDiscrepancy = false

  for (const item of itemStatuses) {
    const isMandatory = mandatory.has(item.fieldName)
    const isRejectionField = REJECTION_FIELDS.has(item.fieldName)
    const isMinorField = MINOR_DISCREPANCY_FIELDS.has(item.fieldName)

    if (item.status === 'match') {
      continue
    }

    if (item.status === 'not_found' && isMandatory) {
      if (isRejectionField) {
        hasRejection = true
      } else {
        hasSubstantiveMismatch = true
      }
      continue
    }

    if (item.status === 'mismatch' || item.status === 'needs_correction') {
      if (isRejectionField) {
        hasRejection = true
      } else if (isMinorField) {
        hasMinorDiscrepancy = true
      } else if (isMandatory) {
        hasSubstantiveMismatch = true
      } else {
        // Optional field mismatch — minor discrepancy
        hasMinorDiscrepancy = true
      }
    }
  }

  if (hasRejection) {
    return { status: 'rejected', deadlineDays: null }
  }

  if (hasSubstantiveMismatch) {
    return {
      status: 'needs_correction',
      deadlineDays: CORRECTION_DEADLINE_DAYS,
    }
  }

  if (hasMinorDiscrepancy) {
    return {
      status: 'conditionally_approved',
      deadlineDays: CONDITIONAL_DEADLINE_DAYS,
    }
  }

  return { status: 'approved', deadlineDays: null }
}
