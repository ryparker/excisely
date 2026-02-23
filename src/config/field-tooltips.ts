/**
 * Structured tooltip data for TTB field names.
 * Displayed when users hover over field labels in validation,
 * review, and submission detail views.
 */
export interface FieldTooltipData {
  /** Plain-English description of the field. */
  description: string
  /** Optional example values. */
  example?: string
  /** Optional form reference (e.g. "Form 5100.31, Item 6"). */
  reference?: string
  /** CFR section IDs this field is governed by (e.g. ['5.63', '4.33']). */
  cfr?: string[]
}

export const FIELD_TOOLTIPS: Record<string, FieldTooltipData> = {
  brand_name: {
    description: 'The primary trademarked name consumers know the product by.',
    example: "Jack Daniel's, Bulleit, Maker's Mark",
    reference: 'Form 5100.31, Item 6',
    cfr: ['5.63', '4.33', '7.63'],
  },
  fanciful_name: {
    description:
      'An optional creative or distinctive secondary name that identifies a specific product variant. Not the brand name, grape varietal, or product type.',
    example: 'Trip Thru the Woods, Frontier Whiskey, Estate',
    reference: 'Form 5100.31, Item 7',
    cfr: ['5.64'],
  },
  class_type: {
    description: 'The legal product category as defined by TTB regulations.',
    example: 'Kentucky Straight Bourbon Whiskey, Table Wine, India Pale Ale',
    cfr: ['5.64', '4.34', '7.64'],
  },
  alcohol_content: {
    description:
      'The alcohol content as shown on the label, typically expressed as a percentage by volume.',
    example: '12.5% Alc./Vol., 80 Proof',
    cfr: ['5.65', '4.36', '7.65'],
  },
  net_contents: {
    description:
      'The volume statement as printed on the label, including units. Different from Total Bottle Capacity, which is the numeric value in mL used for Standards of Fill validation.',
    example: '750 mL, 12 FL OZ, 1 Liter',
    cfr: ['5.70', '4.37', '7.70'],
  },
  health_warning: {
    description:
      'The federally mandated GOVERNMENT WARNING statement about pregnancy risks and impaired driving.',
    cfr: ['16.21', '16.22'],
  },
  name_and_address: {
    description:
      'The name and address of the bottler, distiller, importer, or producer.',
    example: 'Jack Daniel Distillery, Lynchburg, Tennessee',
    reference: 'Form 5100.31, Item 8',
    cfr: ['5.66', '4.35', '7.66'],
  },
  qualifying_phrase: {
    description:
      'The phrase preceding the producer info that describes their relationship to the product.',
    example: 'Bottled by, Distilled by, Produced and Bottled by',
    cfr: ['5.66', '4.35', '7.66'],
  },
  country_of_origin: {
    description: 'Country of origin for imported products.',
    example: 'Product of France, Product of Scotland',
    cfr: ['5.74'],
  },
  grape_varietal: {
    description: 'The grape variety used in the wine.',
    example: 'Cabernet Sauvignon, Chardonnay, Pinot Noir',
    cfr: ['4.34'],
  },
  appellation_of_origin: {
    description: 'The geographic origin of the grapes.',
    example: 'Napa Valley, Willamette Valley, Sonoma Coast',
    cfr: ['4.25'],
  },
  vintage_year: {
    description: 'The year the grapes were harvested.',
    example: '2019, 2021',
    cfr: ['4.27'],
  },
  sulfite_declaration: {
    description: 'Required declaration if the wine contains sulfites.',
    example: 'Contains Sulfites',
    cfr: ['4.32'],
  },
  age_statement: {
    description: 'How long the spirit was aged.',
    example: 'Aged 10 Years, Aged 12 Years',
    cfr: ['5.141'],
  },
  state_of_distillation: {
    description: 'The state where the spirit was distilled.',
    example: 'Kentucky, Tennessee',
    cfr: ['5.142'],
  },
  standards_of_fill: {
    description:
      'The numeric container size in milliliters, used to validate against TTB-approved standards of fill.',
    example: '750, 1000, 1750',
    reference: 'Form 5100.31, Item 12',
    cfr: ['5.71'],
  },
}
