import { BEVERAGE_TYPES, type BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Field descriptions for the classification prompt
// ---------------------------------------------------------------------------

const FIELD_DESCRIPTIONS: Record<string, string> = {
  brand_name:
    'The brand name under which the product is sold (Form Item 6). Usually the most prominent text.',
  fanciful_name:
    'A distinctive or descriptive name that further identifies the product (Form Item 7). Separate from the brand name.',
  class_type:
    'The class, type, or other designation of the product (e.g., "Bourbon Whisky", "Cabernet Sauvignon", "India Pale Ale").',
  alcohol_content:
    'The alcohol content as shown on the label, typically expressed as "XX% Alc./Vol." or "XX% Alc/Vol" or "XX Proof".',
  net_contents:
    'The total bottle capacity / net contents (e.g., "750 mL", "1 L", "12 FL OZ").',
  health_warning:
    'The federally mandated health warning statement. Must begin with "GOVERNMENT WARNING:" in all capital letters, followed by two numbered statements about pregnancy and impaired driving.',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer. Includes the qualifying phrase (e.g., "Bottled by", "Distilled by").',
  qualifying_phrase:
    'The phrase preceding the name and address (e.g., "Bottled by", "Distilled by", "Imported by", "Produced by", "Brewed by").',
  country_of_origin:
    'The country of origin statement for imported products (e.g., "Product of Scotland", "Imported from France").',
  grape_varietal:
    'The grape variety or varieties used (wine only, e.g., "Cabernet Sauvignon", "Chardonnay").',
  appellation_of_origin:
    'The geographic origin of the grapes (wine only, e.g., "Napa Valley", "Sonoma Coast", "American").',
  vintage_year:
    'The year the grapes were harvested (wine only, e.g., "2021", "2022").',
  sulfite_declaration:
    'A sulfite content declaration (wine only, e.g., "Contains Sulfites").',
  age_statement:
    'An age or maturation statement (spirits only, e.g., "Aged 12 Years", "8 Year Old").',
  state_of_distillation:
    'The state where the spirit was distilled (spirits only, e.g., "Distilled in Kentucky").',
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

  return `You are classifying text extracted from an alcohol beverage label image via OCR.

## Task

Given the OCR-extracted text from a **${config.label}** label, identify and extract the following TTB-regulated fields. For each field found, provide:
1. The field name (exactly as listed below)
2. The extracted value (reconstructed from the word list)
3. The indices of the words that make up this field's value
4. A confidence score from 0 to 100
5. Brief reasoning for your classification

## Fields to Identify

${fieldListText}

## Important Rules

1. **"GOVERNMENT WARNING:" prefix must be in ALL CAPS** — the health warning statement always begins with "GOVERNMENT WARNING:" followed by two numbered statements.
2. **The health warning is a specific federally mandated text**: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
3. **Word indices must be exact** — only reference indices from the provided word list.
4. **If a field is not found**, still include it with a null value and 0 confidence.
5. **Qualifying phrase** is the prefix before the name/address (e.g., "Bottled by") — extract it separately from name_and_address.
6. **Alcohol content** should include the full expression (e.g., "45% Alc./Vol." not just "45").
7. **Net contents** should include units (e.g., "750 mL" not just "750").
8. **Reconstruct multi-word values** by joining the words at the referenced indices in order.

## OCR Full Text

${ocrText}

## Numbered Word List

${wordListText}

## Response Format

Return a JSON object with a "fields" array. Each element must have: fieldName, value (string or null), confidence (0-100), wordIndices (array of integers), reasoning (string or null).`
}
