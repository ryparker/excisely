import type { BeverageType } from '@/config/beverage-types'
import { ALL_SECTIONS, type RegulationSection } from '@/config/regulations'

/**
 * Returns regulation sections that reference the given field name.
 * Used by FieldLabel and FieldComparisonRow to show contextual citations.
 */
export function getRegulationsForField(fieldName: string): RegulationSection[] {
  return ALL_SECTIONS.filter((s) => s.relatedFields.includes(fieldName))
}

/**
 * Returns regulation sections that apply to a given beverage type.
 */
export function getRegulationsForBeverageType(
  type: BeverageType,
): RegulationSection[] {
  return ALL_SECTIONS.filter((s) => s.appliesTo.includes(type))
}

/**
 * Simple text search across citations, titles, summaries, and key requirements.
 * Case-insensitive, matches any substring.
 */
export function searchRegulations(query: string): RegulationSection[] {
  const q = query.toLowerCase().trim()
  if (!q) return ALL_SECTIONS

  return ALL_SECTIONS.filter(
    (s) =>
      s.citation.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.keyRequirements.some((r) => r.toLowerCase().includes(q)),
  )
}

/**
 * Look up a single section by its short ID (e.g., "5.63").
 */
export function getSection(sectionId: string): RegulationSection | undefined {
  return ALL_SECTIONS.find((s) => s.section === sectionId)
}
