export interface SeedSetting {
  key: string
  value: unknown
}

export const SEED_SETTINGS: SeedSetting[] = [
  {
    key: 'field_strictness',
    value: {
      health_warning: 'strict',
      brand_name: 'moderate',
      fanciful_name: 'moderate',
      class_type: 'moderate',
      alcohol_content: 'strict',
      net_contents: 'strict',
      name_and_address: 'lenient',
      qualifying_phrase: 'lenient',
      country_of_origin: 'moderate',
      grape_varietal: 'moderate',
      appellation_of_origin: 'moderate',
      vintage_year: 'strict',
      sulfite_declaration: 'strict',
      age_statement: 'moderate',
      state_of_distillation: 'moderate',
    },
  },
  {
    key: 'auto_approve_threshold',
    value: 95,
  },
  {
    key: 'correction_deadline_days',
    value: {
      needs_correction: 30,
      conditionally_approved: 7,
    },
  },
]
