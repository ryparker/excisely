/**
 * Mandatory health warning statement per 27 CFR Part 16.
 *
 * Formatting rules (27 CFR 16.21–16.22):
 * - "GOVERNMENT WARNING:" prefix must appear in ALL CAPS and BOLD
 * - The body text (sections 1 and 2) must NOT be bold
 * - The entire statement must appear on a single label panel
 * - Text must be conspicuous and readily legible
 * - Minimum type size depends on container volume (see getHealthWarningMinTypeSizeMm)
 * - Must not be obscured by surrounding artwork or text
 */

export const HEALTH_WARNING_PREFIX = 'GOVERNMENT WARNING:'

export const HEALTH_WARNING_SECTION_1 =
  '(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects.'

export const HEALTH_WARNING_SECTION_2 =
  '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

export const HEALTH_WARNING_FULL = `GOVERNMENT WARNING: ${HEALTH_WARNING_SECTION_1} ${HEALTH_WARNING_SECTION_2}`

/**
 * Validates whether the given text matches the mandatory health warning statement.
 * Checks the prefix, full text content, and correct punctuation.
 */
export function isValidHealthWarning(text: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  const trimmed = text.trim()

  if (trimmed.length === 0) {
    return { valid: false, issues: ['Health warning statement is empty'] }
  }

  // Check that the prefix is present and in ALL CAPS
  if (!trimmed.startsWith(HEALTH_WARNING_PREFIX)) {
    const lowerPrefix = trimmed.toLowerCase()
    if (lowerPrefix.startsWith('government warning:')) {
      issues.push('"GOVERNMENT WARNING:" prefix must be in ALL CAPS')
    } else {
      issues.push('Missing "GOVERNMENT WARNING:" prefix')
    }
  }

  // Normalize whitespace for content comparison
  const normalized = trimmed.replace(/\s+/g, ' ')
  const expectedNormalized = HEALTH_WARNING_FULL.replace(/\s+/g, ' ')

  if (normalized !== expectedNormalized) {
    // Check for section 1
    if (!normalized.includes(HEALTH_WARNING_SECTION_1.replace(/\s+/g, ' '))) {
      issues.push(
        'Missing or incorrect section (1) — Surgeon General pregnancy warning',
      )
    }

    // Check for section 2
    if (!normalized.includes(HEALTH_WARNING_SECTION_2.replace(/\s+/g, ' '))) {
      issues.push(
        'Missing or incorrect section (2) — impaired driving/machinery warning',
      )
    }

    // Check punctuation markers
    if (!normalized.includes('(1)')) {
      issues.push('Missing section number "(1)"')
    }
    if (!normalized.includes('(2)')) {
      issues.push('Missing section number "(2)"')
    }

    // If no specific issues were identified, flag a general mismatch
    if (issues.length === 0) {
      issues.push('Health warning text does not match the required statement')
    }
  }

  return { valid: issues.length === 0, issues }
}
