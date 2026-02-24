import type { LucideIcon } from 'lucide-react'
import { Wine, Beer, Martini } from 'lucide-react'

import type { BeverageType } from '@/config/beverage-types'
import type { ValidateLabelInput } from '@/lib/validators/label-schema'

// ---------------------------------------------------------------------------
// Beverage type options for radio/card/segmented selectors
// ---------------------------------------------------------------------------

export interface BeverageTypeOption {
  value: BeverageType
  label: string
  description: string
  icon: LucideIcon
}

export const BEVERAGE_TYPE_OPTIONS: BeverageTypeOption[] = [
  {
    value: 'distilled_spirits',
    label: 'Distilled Spirits',
    description: 'Whiskey, vodka, gin, rum, tequila, brandy',
    icon: Martini,
  },
  {
    value: 'wine',
    label: 'Wine',
    description: 'Table wine, sparkling, dessert, vermouth',
    icon: Wine,
  },
  {
    value: 'malt_beverage',
    label: 'Malt Beverages',
    description: 'Beer, ale, lager, malt liquor, hard seltzer',
    icon: Beer,
  },
]

// ---------------------------------------------------------------------------
// File accept map for dropzone
// ---------------------------------------------------------------------------

export const ACCEPT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// ---------------------------------------------------------------------------
// Field name mappings: snake_case (AI extraction) -> camelCase (form)
// ---------------------------------------------------------------------------

/** Reverse mapping: snake_case extracted field -> camelCase form field */
export const SNAKE_TO_CAMEL: Record<string, keyof ValidateLabelInput> = {
  brand_name: 'brandName',
  fanciful_name: 'fancifulName',
  class_type: 'classType',
  alcohol_content: 'alcoholContent',
  net_contents: 'netContents',
  health_warning: 'healthWarning',
  name_and_address: 'nameAndAddress',
  qualifying_phrase: 'qualifyingPhrase',
  country_of_origin: 'countryOfOrigin',
  grape_varietal: 'grapeVarietal',
  appellation_of_origin: 'appellationOfOrigin',
  vintage_year: 'vintageYear',
  age_statement: 'ageStatement',
  state_of_distillation: 'stateOfDistillation',
}

/** Fields that are mapped via SNAKE_TO_CAMEL for pre-fill (text inputs) */
export const PREFILLABLE_FIELDS = new Set(Object.keys(SNAKE_TO_CAMEL))

// ---------------------------------------------------------------------------
// Motion animation presets
// ---------------------------------------------------------------------------

export const phaseInitial = { opacity: 0, y: 20 }
export const phaseAnimate = { opacity: 1, y: 0 }
export const phaseExit = { opacity: 0, y: -10 }
export const phaseTransition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}
