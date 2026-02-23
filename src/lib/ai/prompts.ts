import { BEVERAGE_TYPES, type BeverageType } from '@/config/beverage-types'

function escapePromptValue(value: string): string {
  return value.replace(/["""]/g, "'").slice(0, 500)
}

// ---------------------------------------------------------------------------
// Field descriptions for the classification prompt
// ---------------------------------------------------------------------------

const FIELD_DESCRIPTIONS: Record<string, string> = {
  brand_name:
    'The brand name under which the product is sold (Form Item 6). Usually the most prominent, largest text on the front label. This is the trademarked name consumers know the product by (e.g., "Bulleit", "Rainy Day", "Knob Creek").',
  fanciful_name:
    'A distinctive or imaginative secondary name that further identifies this specific product VARIANT (Form Item 7). NOT the brand name, NOT the class/type. This is an optional creative/marketing name like "Old Fashioned", "Frontier Whiskey", "Single Barrel Select". A grape varietal name (like "Albariño", "Viognier") is NOT a fanciful name — it belongs in grape_varietal.',
  class_type:
    'The regulatory class, type, or designation of the product as defined by TTB regulations. For spirits: "Bourbon Whisky", "Kentucky Straight Bourbon Whiskey", "Rye Whiskey", "Vodka", "Gin". For wine: "Table Wine", "Red Wine", "White Wine", "Sparkling Wine". For malt beverages: "Ale", "Lager", "India Pale Ale", "Hard Seltzer". This is the LEGAL product category, not a marketing name.',
  alcohol_content:
    'The alcohol content as shown on the label, typically expressed as "XX% Alc./Vol." or "XX% Alc/Vol" or "XX% ABV" or "XX Proof". Include the full expression with units.',
  net_contents:
    'The total bottle capacity / net contents (e.g., "750 mL", "1 L", "12 FL OZ", "355 mL"). Include units.',
  health_warning:
    'The federally mandated GOVERNMENT WARNING statement. Must begin with "GOVERNMENT WARNING:" in all capital letters, followed by two numbered statements about pregnancy risks and impaired driving/health problems. This is a long block of small text, typically on the back label.',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer (Form Item 8). Typically formatted as "Company Name, City, State" or "Company Name, City, State, Country". Do NOT include the qualifying phrase prefix here.',
  qualifying_phrase:
    'The specific phrase that precedes the name and address: "Bottled by", "Distilled by", "Imported by", "Produced by", "Produced and Bottled by", "Cellared and Bottled by", "Brewed by", "Vinted and Bottled by". Extract ONLY this phrase, not the name/address that follows.',
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
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds a classification prompt for GPT-5 Mini that instructs the model
 * to identify TTB-regulated fields from OCR-extracted text.
 */
export function buildClassificationPrompt(
  ocrText: string,
  beverageType: string,
  wordList: Array<{ index: number; text: string }>,
  applicationData?: Record<string, string>,
): string {
  const config = BEVERAGE_TYPES[beverageType as BeverageType]
  if (!config) {
    throw new Error(`Unknown beverage type: ${beverageType}`)
  }

  const allFields = [...config.mandatoryFields, ...config.optionalFields]
  const fieldListText = allFields
    .map((field) => {
      const desc = FIELD_DESCRIPTIONS[field] ?? field
      const mandatory = config.mandatoryFields.includes(field)
      return `- **${field}** (${mandatory ? 'MANDATORY' : 'optional'}): ${desc}`
    })
    .join('\n')

  const wordListText = wordList
    .map((w) => `[${w.index}] "${w.text}"`)
    .join('\n')

  return `You are an expert at classifying text extracted from alcohol beverage labels via OCR. Your job is to map OCR words to TTB-regulated label fields with high accuracy.

## Task

Given the OCR-extracted text from a **${config.label}** label, identify and extract the following TTB-regulated fields. For each field found, provide:
1. The field name (exactly as listed below)
2. The extracted value (reconstructed from the word list)
3. The indices of the words that make up this field's value
4. A confidence score from 0 to 100
5. Brief reasoning for your classification

## Fields to Identify

${fieldListText}

## Critical Disambiguation Rules

**brand_name vs. fanciful_name vs. class_type**: These are commonly confused. Follow this hierarchy:
- **brand_name**: The PRIMARY trademarked product name. Largest/most prominent text. The name consumers use to refer to the product. Examples: "Bulleit", "Knob Creek", "Rainy Day", "Cooper Ridge".
- **fanciful_name**: A SECONDARY creative name for a specific product variant. NOT the brand, NOT the grape, NOT the product type. Examples: "Frontier Whiskey" (variant of Bulleit), "Single Barrel Select", "Old Fashioned". If in doubt, leave null.
- **class_type**: The LEGAL product designation per TTB regulations. Examples: "Kentucky Straight Bourbon Whiskey", "Table Wine", "India Pale Ale". This describes WHAT the product IS, not what it's called.

**grape_varietal vs. fanciful_name**: For wine, the grape name (Albariño, Viognier, Cabernet Sauvignon, Malbec) is ALWAYS grape_varietal, NEVER fanciful_name.

**name_and_address vs. qualifying_phrase**: The qualifying phrase is ONLY the prefix like "Bottled by" or "Produced by". The name_and_address is ONLY the company name and location that follows.

## Important Rules

1. **"GOVERNMENT WARNING:" must be in ALL CAPS** — health warning always begins with "GOVERNMENT WARNING:" followed by two numbered statements.
2. **Word indices must be exact** — only reference indices from the provided word list.
3. **If a field is not found**, include it with null value and 0 confidence.
4. **Alcohol content** should include the full expression with units (e.g., "12.5% Alc./Vol." not just "12.5").
5. **Net contents** should include units (e.g., "750 mL" not just "750").
6. **Reconstruct multi-word values** by joining the words at the referenced indices in order.
7. **Do not assign the same words to multiple fields** — each word index should ideally belong to only one field.

## Visual Verification (CRITICAL)

If label images are provided, you MUST visually verify ALL numeric values against the actual image. OCR commonly misreads digits — especially with stylized, embossed, or curved text. Common OCR digit confusions:
- "5" ↔ "1" (e.g., "52%" misread as "12%")
- "8" ↔ "3" or "6"
- "0" ↔ "O" or "D"
- "7" ↔ "1"

**Always trust what you see in the image over what the OCR text says.** If the OCR word list says "12%" but you can clearly see "52%" in the image, use "52%" as the value. This is especially critical for:
- **Alcohol content** (a misread percentage changes the entire validation)
- **Net contents** (volume/weight figures)
- **Vintage year** (wine labels)

## OCR Full Text

${ocrText}

## Numbered Word List

${wordListText}
${
  applicationData && Object.keys(applicationData).length > 0
    ? `
## Application Data (Form 5100.31)

The applicant submitted these expected values on their COLA application. Use this to help identify and disambiguate fields in the OCR text. The applicant knows their own product — trust their field assignments when the OCR text is ambiguous.

${Object.entries(applicationData)
  .map(
    ([field, value]) =>
      `- **${escapePromptValue(field)}**: "${escapePromptValue(value)}"`,
  )
  .join('\n')}

**Important**: Your job is to find WHERE each expected value appears on the label (or confirm it's missing). The application data tells you WHAT to look for; the OCR text tells you what's actually ON the label.
`
    : ''
}
## Image Type Classification

For each image provided, classify which part of the label it shows:
- **front**: The front/main label — brand name, product name, and class/type are prominently displayed
- **back**: The back label — typically contains the health warning statement, ingredients, nutritional info, or UPC barcode
- **neck**: A neck band or collar label — a small label wrapped around the neck of the bottle
- **strip**: A side or connecting strip label — a narrow label on the side connecting front and back
- **other**: Anything that doesn't fit the above categories (e.g., case packaging, closeup detail shots)

Return an "imageClassifications" array with one entry per image. Each entry must have: imageIndex (0-based), imageType, confidence (0-100).

## Response Format

Return a JSON object with:
1. A "fields" array. Each element must have: fieldName, value (string or null), confidence (0-100), wordIndices (array of integers), reasoning (string or null).
2. An "imageClassifications" array. Each element must have: imageIndex (integer, 0-based), imageType (one of "front", "back", "neck", "strip", "other"), confidence (0-100).`
}
