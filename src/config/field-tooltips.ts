/**
 * Plain-English tooltip descriptions for TTB field names.
 * Displayed when users hover over field labels in validation,
 * review, and submission detail views.
 */
export const FIELD_TOOLTIPS: Record<string, string> = {
  brand_name:
    'The primary trademarked name consumers know the product by (Form 5100.31, Item 6)',
  fanciful_name:
    "An optional creative or distinctive secondary name that further identifies a specific product variant — like 'Trip Thru the Woods', 'Frontier Whiskey', or 'Estate'. Not the brand name, grape varietal, or product type. (Form 5100.31, Item 7)",
  class_type:
    "The legal product category as defined by TTB regulations — like 'Kentucky Straight Bourbon Whiskey' for spirits, 'Table Wine' for wine, or 'India Pale Ale' for malt beverages",
  alcohol_content:
    "The alcohol content as shown on the label, typically expressed as a percentage by volume (e.g., '12.5% Alc./Vol.')",
  net_contents:
    "The total volume of the container (e.g., '750 mL', '12 FL OZ', '1 Liter')",
  health_warning:
    'The federally mandated GOVERNMENT WARNING statement about pregnancy risks and impaired driving',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer (Form 5100.31, Item 8)',
  qualifying_phrase:
    "The phrase preceding the producer info — like 'Bottled by', 'Distilled by', 'Produced and Bottled by'",
  country_of_origin:
    "Country of origin for imported products (e.g., 'Product of France')",
  grape_varietal:
    "The grape variety used in the wine (e.g., 'Cabernet Sauvignon', 'Chardonnay')",
  appellation_of_origin:
    "The geographic origin of the grapes (e.g., 'Napa Valley', 'Willamette Valley')",
  vintage_year: 'The year the grapes were harvested',
  sulfite_declaration: 'Required declaration if the wine contains sulfites',
  age_statement: "How long the spirit was aged (e.g., 'Aged 10 Years')",
  state_of_distillation: 'The state where the spirit was distilled',
  standards_of_fill:
    'Whether the container size conforms to TTB standards of fill',
}
