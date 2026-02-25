import { BEVERAGE_TYPES } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Field descriptions (used by rule-classify.ts for reasoning strings)
// ---------------------------------------------------------------------------

export const FIELD_DESCRIPTIONS: Record<string, string> = {
  brand_name:
    'The brand name under which the product is sold (Form Item 6). Usually the most prominent, largest text on the front label. This is the trademarked name consumers know the product by (e.g., "Bulleit", "Rainy Day", "Knob Creek").',
  fanciful_name:
    'A distinctive or imaginative secondary name that further identifies this specific product VARIANT (Form Item 7). NOT the brand name, NOT the class/type. This is an optional creative/marketing name like "Old Fashioned", "Frontier Whiskey", "Single Barrel Select". A grape varietal name (like "Albariño", "Viognier") is NOT a fanciful name — it belongs in grape_varietal.',
  class_type:
    'The regulatory class, type, or designation of the product as defined by TTB regulations. For spirits: "Bourbon Whisky", "Kentucky Straight Bourbon Whiskey", "Rye Whiskey", "Vodka", "Gin". For wine: "Table Wine", "Red Wine", "White Wine", "Sparkling Wine". For malt beverages: "Ale", "Lager", "India Pale Ale", "Hard Seltzer". This is the LEGAL product category, not a marketing name.',
  alcohol_content:
    'The alcohol content as shown on the label, typically expressed as "XX% Alc./Vol." or "XX% Alc/Vol" or "XX% Alcohol by Volume" or "XX Proof". TTB does not permit "ABV" as an abbreviation — only "Alc." and "Vol." are allowed. Include the full expression with units.',
  net_contents:
    'The total bottle capacity / net contents (e.g., "750 mL", "1 L", "12 FL OZ", "355 mL"). Include units.',
  health_warning:
    'The federally mandated GOVERNMENT WARNING statement. Must begin with "GOVERNMENT WARNING:" in all capital letters, followed by two numbered statements about pregnancy risks and impaired driving/health problems. This is a long block of small text, typically on the back label.',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer (Form Item 8). Typically formatted as "Company Name, City, State" or "Company Name, City, State, Country". Do NOT include the qualifying phrase prefix here.',
  qualifying_phrase:
    'The specific phrase that precedes the name and address. Always extract the FULL phrase — if the label says "Produced & Bottled by", return "Produced and Bottled by" (normalize "&" to "and"). PREFER compound phrases over simple ones.',
  country_of_origin:
    'The country of origin statement for imported products (e.g., "Product of France", "Imported from Scotland", "Product of USA"). Only present on imported products.',
  grape_varietal:
    'The grape variety or varieties used (wine only). Examples: "Cabernet Sauvignon", "Chardonnay", "Albariño", "Viognier", "Malbec", "Pinot Noir". This is the GRAPE NAME, not a fanciful name.',
  appellation_of_origin:
    'The geographic origin of the grapes (wine only). Examples: "Napa Valley", "Sonoma Coast", "Willamette Valley", "American", "California", "Columbia Valley".',
  vintage_year:
    'The year the grapes were harvested (wine only). A standalone 4-digit year like "2019", "2021", "2022".',
  sulfite_declaration:
    'A sulfite content declaration (wine only): "Contains Sulfites" or "Contains Sulfites."',
  age_statement:
    'An age or maturation statement (spirits only, e.g., "Aged 10 Years", "8 Year Old", "Aged a Minimum of 4 Years").',
  state_of_distillation:
    'The state where the spirit was distilled (spirits only, e.g., "Distilled in Kentucky", "Kentucky Straight").',
  standards_of_fill:
    'Whether the container size conforms to TTB standards of fill for the beverage type.',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collects the union of ALL fields across ALL beverage types.
 * Used by extraction when beverage type is unknown.
 */
export function getAllFieldNames(): string[] {
  const allFields = new Set<string>()
  for (const config of Object.values(BEVERAGE_TYPES)) {
    for (const f of config.mandatoryFields) allFields.add(f)
    for (const f of config.optionalFields) allFields.add(f)
  }
  return [...allFields]
}
