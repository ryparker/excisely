import { humanizeEnum } from '@/lib/utils'

export const FIELD_DISPLAY_NAMES: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning Statement',
  name_and_address: 'Name and Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation of Origin',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Declaration',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
  standards_of_fill: 'Standards of Fill',
}

/** Look up the human-readable display name for a field key, falling back to title-cased snake_case. */
export function formatFieldName(name: string): string {
  return FIELD_DISPLAY_NAMES[name] ?? humanizeEnum(name)
}

/** Pre-built filter options derived from FIELD_DISPLAY_NAMES, with an "All Fields" entry. */
export const FIELD_FILTER_OPTIONS = [
  { label: 'All Fields', value: '' },
  ...Object.entries(FIELD_DISPLAY_NAMES).map(([value, label]) => ({
    label,
    value,
  })),
]
