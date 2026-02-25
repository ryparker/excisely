import { BEVERAGE_TYPES, type BeverageType } from '@/config/beverage-types'

function escapePromptValue(value: string): string {
  return value.replace(/["""]/g, "'").slice(0, 500)
}

/**
 * Collects the union of ALL fields across ALL beverage types.
 * Used by the extraction prompt when beverage type is unknown.
 */
function getAllFieldNames(): string[] {
  const allFields = new Set<string>()
  for (const config of Object.values(BEVERAGE_TYPES)) {
    for (const f of config.mandatoryFields) allFields.add(f)
    for (const f of config.optionalFields) allFields.add(f)
  }
  return [...allFields]
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
    'The alcohol content as shown on the label, typically expressed as "XX% Alc./Vol." or "XX% Alc/Vol" or "XX% Alcohol by Volume" or "XX Proof". TTB does not permit "ABV" as an abbreviation — only "Alc." and "Vol." are allowed. Include the full expression with units.',
  net_contents:
    'The total bottle capacity / net contents (e.g., "750 mL", "1 L", "12 FL OZ", "355 mL"). Include units.',
  health_warning:
    'The federally mandated GOVERNMENT WARNING statement. Must begin with "GOVERNMENT WARNING:" in all capital letters, followed by two numbered statements about pregnancy risks and impaired driving/health problems. This is a long block of small text, typically on the back label.',
  name_and_address:
    'The name and address of the bottler, distiller, importer, or producer (Form Item 8). Typically formatted as "Company Name, City, State" or "Company Name, City, State, Country". Do NOT include the qualifying phrase prefix here.',
  qualifying_phrase:
    'The specific phrase that precedes the name and address. Always extract the FULL phrase — if the label says "Produced & Bottled by", return "Produced and Bottled by" (normalize "&" to "and"). PREFER compound phrases over simple ones. Compound: "Distilled and Bottled by", "Produced and Bottled by", "Cellared and Bottled by", "Vinted and Bottled by", "Prepared and Bottled by", "Brewed and Bottled by", "Imported and Bottled by". Single: "Bottled by", "Packed by", "Distilled by", "Blended by", "Produced by", "Prepared by", "Made by", "Manufactured by", "Imported by", "Brewed by". Contract: "Bottled for", "Distilled by and Bottled for". Wine: "Estate Bottled". Return ONLY the phrase, not the company name that follows.',
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
 * Builds a classification prompt for GPT-5 Mini / GPT-4.1 that instructs the model
 * to identify TTB-regulated fields from OCR-extracted text.
 */
export function buildClassificationPrompt(
  ocrText: string,
  beverageType: BeverageType,
  wordList: Array<{ index: number; text: string }>,
  applicationData?: Record<string, string>,
): string {
  const config = BEVERAGE_TYPES[beverageType]
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

**name_and_address vs. qualifying_phrase**: The qualifying phrase is ONLY the prefix like "Bottled by" or "Produced and Bottled by". Always use the FULL compound phrase when present (e.g., "Produced & Bottled by" → "Produced and Bottled by", not just "Bottled by"). Normalize "&" to "and". The name_and_address is ONLY the company name and location that follows.

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

// ---------------------------------------------------------------------------
// Fast extraction prompt (applicant pre-fill — lean, no reasoning)
// ---------------------------------------------------------------------------

/**
 * Builds a streamlined prompt for fast applicant pre-fill extraction.
 * Key differences from buildClassificationPrompt:
 * - No reasoning requested → ~50% fewer output tokens
 * - No image classification → less output
 * - Only return fields actually found (skip null-value fields)
 * - Shorter instructions → faster time-to-first-token
 */
/** Fields to skip in fast extraction — auto-filled or computed elsewhere */
const SKIP_FIELDS = new Set(['health_warning', 'standards_of_fill'])

/** Compact field descriptions for fast extraction (GPT-4.1 Mini needs explicit guidance) */
const FAST_FIELD_DESCRIPTIONS: Record<string, string> = {
  brand_name:
    'The primary trademarked product name — the largest, most prominent text on the front label. Examples: "Bulleit", "Maker\'s Mark", "Knob Creek", "Cooper Ridge"',
  fanciful_name:
    'A secondary creative/marketing name for a specific product variant (NOT the brand, NOT the grape, NOT the class/type). Examples: "Frontier Whiskey", "Single Barrel Select", "Old Fashioned". Omit if none.',
  class_type:
    'The legal product designation per TTB regulations. Spirits: "Kentucky Straight Bourbon Whiskey", "Vodka", "London Dry Gin". Wine: "Table Wine", "Red Wine", "Sparkling Wine". Malt: "Ale", "Lager", "India Pale Ale", "Hard Seltzer"',
  alcohol_content:
    'Alcohol content WITH units exactly as shown. Examples: "40% Alc./Vol.", "80 Proof", "12.5% Alc/Vol"',
  net_contents:
    'Bottle volume WITH units. Examples: "750 mL", "1 L", "12 FL OZ", "355 mL"',
  name_and_address:
    'Company name and location AFTER the qualifying phrase. Examples: "Beam Suntory, Clermont, KY", "Jackson Family Wines, Santa Rosa, CA". Do NOT include the qualifying phrase prefix.',
  qualifying_phrase:
    'ONLY the prefix phrase before the company name. Always extract the FULL phrase — if the label says "Produced & Bottled by" or "PRODUCED AND BOTTLED BY", return "Produced and Bottled by" (normalize "&" to "and"). Compound phrases: "Distilled and Bottled by", "Produced and Bottled by", "Cellared and Bottled by", "Vinted and Bottled by", "Prepared and Bottled by", "Brewed and Bottled by", "Imported and Bottled by". Single: "Bottled by", "Distilled by", "Produced by", "Imported by", "Brewed by", "Made by". Contract: "Bottled for", "Distilled by and Bottled for". Wine: "Estate Bottled". PREFER compound phrases over simple ones when the label has both words.',
  country_of_origin:
    'Country of origin statement for imported products. Examples: "Product of France", "Imported from Scotland", "Product of USA". Omit if not found.',
  grape_varietal:
    'Grape variety name (wine only). Examples: "Cabernet Sauvignon", "Chardonnay", "Albariño", "Pinot Noir". This is the GRAPE NAME, never a fanciful name.',
  appellation_of_origin:
    'Geographic origin of grapes (wine only). Examples: "Napa Valley", "Sonoma Coast", "California", "Columbia Valley"',
  vintage_year:
    'Harvest year (wine only). A 4-digit year like "2019", "2021", "2022"',
  sulfite_declaration:
    'Sulfite statement (wine only). Usually "Contains Sulfites"',
  age_statement:
    'Age/maturation statement (spirits only). Examples: "Aged 10 Years", "8 Year Old", "Aged a Minimum of 4 Years"',
  state_of_distillation:
    'State where distilled (spirits only). Examples: "Distilled in Kentucky", "Kentucky Straight"',
}

/**
 * Returns { system, user } messages for fast extraction.
 * Split so the system message is cacheable across calls (OpenAI prompt caching).
 * Uses explicit per-field descriptions so GPT-4.1 Mini knows exactly what to extract.
 */
export function buildFastExtractionMessages(
  ocrText: string,
  beverageType: BeverageType,
): { system: string; user: string } {
  const config = BEVERAGE_TYPES[beverageType]
  if (!config) {
    throw new Error(`Unknown beverage type: ${beverageType}`)
  }

  const mandatorySet = new Set(config.mandatoryFields)
  const allFields = [
    ...config.mandatoryFields,
    ...config.optionalFields,
  ].filter((f) => !SKIP_FIELDS.has(f))

  const fieldListText = allFields
    .map((f) => {
      const tag = mandatorySet.has(f) ? ' [REQUIRED]' : ''
      return `- ${f}${tag}: ${FAST_FIELD_DESCRIPTIONS[f] ?? f}`
    })
    .join('\n')

  const system = `You extract TTB-regulated fields from ${config.label} label OCR text. Return ALL fields you find. Use exact fieldName values listed below. Fields marked [REQUIRED] almost always appear on labels — look carefully for them.

## Fields

${fieldListText}

## Rules
- Use fieldName EXACTLY as listed (snake_case).
- ALWAYS extract class_type — this is the legal product category (e.g., "Kentucky Straight Bourbon Whiskey", "Vodka", "Table Wine", "Ale"). It is different from brand_name.
- brand_name is the PRIMARY trademarked name (largest text). class_type is the LEGAL product category. Do NOT confuse them.
- qualifying_phrase must be ONLY the prefix ("Bottled by", "Distilled by", etc.), NOT the company name.
- IMPORTANT: Always extract the FULL qualifying phrase. If the label says "Produced & Bottled by" or "PRODUCED AND BOTTLED BY", the qualifying_phrase is "Produced and Bottled by" (the full compound phrase), NOT just "Bottled by". Treat "&" as equivalent to "and". Prefer compound forms over simple ones.
- name_and_address is ONLY the company + location AFTER the qualifying phrase prefix.
- Include units for alcohol_content and net_contents.
- For wine: grape varietal is ALWAYS grape_varietal, NEVER fanciful_name.`

  return { system, user: ocrText }
}

// ---------------------------------------------------------------------------
// Submission classification prompt (gpt-4.1-nano, text-only, compact)
// ---------------------------------------------------------------------------

/**
 * Builds a submission-optimized prompt for gpt-4.1-nano.
 * Optimized for speed: concise instructions, system/user split for prompt caching.
 * - No images, no word indices, no image classification
 * - Keeps: field descriptions, disambiguation rules, application data, confidence/reasoning
 *
 * Returns { system, user } for OpenAI prompt caching (system is cacheable across calls).
 */
export function buildSubmissionClassificationPrompt(
  ocrText: string,
  beverageType: BeverageType,
  applicationData?: Record<string, string>,
): { system: string; user: string } {
  const config = BEVERAGE_TYPES[beverageType]
  if (!config) {
    throw new Error(`Unknown beverage type: ${beverageType}`)
  }

  const allFields = [...config.mandatoryFields, ...config.optionalFields]

  const system = `Extract TTB label fields from ${config.label} OCR text. For each field, return fieldName, value (string|null), confidence (0-100).

Fields: ${allFields.join(', ')}

Rules:
- brand_name = primary trademarked name (largest text), NOT class/type
- fanciful_name = secondary creative/marketing name, NOT brand/grape/type. null if absent.
- class_type = legal product designation (e.g. "Vodka", "Table Wine", "India Pale Ale")
- grape_varietal = grape name for wine, NEVER fanciful_name
- qualifying_phrase = ONLY prefix phrase ("Bottled by", "Produced and Bottled by"). Normalize "&"→"and". FULL compound form.
- name_and_address = company + location AFTER qualifying phrase
- health_warning starts with "GOVERNMENT WARNING:" in ALL CAPS
- alcohol_content is on virtually ALL commercial labels — look for "XX% Alc./Vol." or "XX% Alc/Vol" patterns
- Include units for alcohol_content and net_contents
- If not found: null value, 0 confidence`

  let user = ocrText

  if (applicationData && Object.keys(applicationData).length > 0) {
    user += `\n\nExpected values (find on label or confirm missing):\n${Object.entries(
      applicationData,
    )
      .map(([f, v]) => `${escapePromptValue(f)}: ${escapePromptValue(v)}`)
      .join('\n')}`
  }

  return { system, user }
}

// ---------------------------------------------------------------------------
// Extraction prompt (no beverage type required — union of all fields)
// ---------------------------------------------------------------------------

/**
 * Builds a prompt for applicant-side extraction when beverage type is unknown.
 * Lists ALL fields from ALL beverage types (union) and asks the model to also
 * detect the beverage type from the label.
 */
export function buildExtractionPrompt(
  ocrText: string,
  wordList: Array<{ index: number; text: string }>,
): string {
  const allFields = getAllFieldNames()
  const fieldListText = allFields
    .map((field) => {
      const desc = FIELD_DESCRIPTIONS[field] ?? field
      return `- **${field}**: ${desc}`
    })
    .join('\n')

  const wordListText = wordList
    .map((w) => `[${w.index}] "${w.text}"`)
    .join('\n')

  return `You are an expert at reading alcohol beverage labels. Your job is to extract ALL TTB-regulated field values from label images and OCR text — even when the beverage type is unknown.

## Task

Given the OCR-extracted text from an alcohol beverage label (type unknown), identify and extract the following TTB-regulated fields. For each field found, provide:
1. The field name (exactly as listed below)
2. The extracted value (reconstructed from the word list)
3. The indices of the words that make up this field's value
4. A confidence score from 0 to 100
5. Brief reasoning for your classification

## Fields to Identify

${fieldListText}

## Critical Disambiguation Rules

**brand_name vs. fanciful_name vs. class_type**: These are commonly confused. Follow this hierarchy:
- **brand_name**: The PRIMARY trademarked product name. Largest/most prominent text. The name consumers use to refer to the product.
- **fanciful_name**: A SECONDARY creative name for a specific product variant. NOT the brand, NOT the grape, NOT the product type.
- **class_type**: The LEGAL product designation per TTB regulations.

**grape_varietal vs. fanciful_name**: For wine, the grape name is ALWAYS grape_varietal, NEVER fanciful_name.

**name_and_address vs. qualifying_phrase**: The qualifying phrase is ONLY the prefix like "Bottled by" or "Produced and Bottled by". Always use the FULL compound phrase when present (e.g., "Produced & Bottled by" → "Produced and Bottled by", not just "Bottled by"). Normalize "&" to "and". The name_and_address is ONLY the company name and location that follows.

## Important Rules

1. **"GOVERNMENT WARNING:" must be in ALL CAPS** — health warning always begins with "GOVERNMENT WARNING:".
2. **Word indices must be exact** — only reference indices from the provided word list.
3. **If a field is not found**, include it with null value and 0 confidence.
4. **Alcohol content** should include the full expression with units.
5. **Net contents** should include units.
6. **Reconstruct multi-word values** by joining the words at the referenced indices in order.
7. **Do not assign the same words to multiple fields**.

## Visual Verification (CRITICAL)

If label images are provided, you MUST visually verify ALL numeric values against the actual image. OCR commonly misreads digits. **Always trust what you see in the image over what the OCR text says.**

## Beverage Type Detection

Based on the label content, determine the beverage type. Return it in "detectedBeverageType" as one of: "distilled_spirits", "wine", "malt_beverage", or null if you cannot determine it.

Hints:
- Spirits: look for proof, age statements, "whiskey", "vodka", "gin", "rum", "tequila", "bourbon"
- Wine: look for grape varietals, vintage years, appellations, "wine", "contains sulfites"
- Malt beverages: look for "ale", "lager", "IPA", "beer", "malt", "brewed by", "hard seltzer"

## OCR Full Text

${ocrText}

## Numbered Word List

${wordListText}

## Image Type Classification

For each image provided, classify which part of the label it shows:
- **front**: The front/main label
- **back**: The back label (health warning, ingredients, UPC)
- **neck**: A neck band or collar label
- **strip**: A side or connecting strip label
- **other**: Anything else

Return an "imageClassifications" array with one entry per image.

## Response Format

Return a JSON object with:
1. A "fields" array. Each element must have: fieldName, value (string or null), confidence (0-100), wordIndices (array of integers), reasoning (string or null).
2. An "imageClassifications" array. Each element must have: imageIndex (integer, 0-based), imageType (one of "front", "back", "neck", "strip", "other"), confidence (0-100).
3. A "detectedBeverageType" field: one of "distilled_spirits", "wine", "malt_beverage", or null.`
}
