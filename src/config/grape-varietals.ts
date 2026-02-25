/**
 * Common grape varietals found on TTB-regulated wine labels.
 *
 * Used by the rule-based classifier to identify grape_varietal fields
 * in OCR text without requiring an LLM. Covers the most common
 * varietals appearing on US-market wine labels.
 */
export const GRAPE_VARIETALS = [
  // Red varietals
  'Cabernet Sauvignon',
  'Merlot',
  'Pinot Noir',
  'Syrah',
  'Shiraz',
  'Zinfandel',
  'Malbec',
  'Tempranillo',
  'Sangiovese',
  'Nebbiolo',
  'Barbera',
  'Grenache',
  'Mourvèdre',
  'Petite Sirah',
  'Petit Verdot',
  'Cabernet Franc',
  'Carménère',
  'Montepulciano',
  'Primitivo',
  'Pinotage',
  'Tannat',
  'Touriga Nacional',
  'Dolcetto',
  'Gamay',
  'Corvina',
  'Nero d\'Avola',
  'Aglianico',

  // White varietals
  'Chardonnay',
  'Sauvignon Blanc',
  'Riesling',
  'Pinot Grigio',
  'Pinot Gris',
  'Moscato',
  'Muscat',
  'Gewürztraminer',
  'Viognier',
  'Albariño',
  'Chenin Blanc',
  'Sémillon',
  'Grüner Veltliner',
  'Torrontés',
  'Verdejo',
  'Vermentino',
  'Marsanne',
  'Roussanne',
  'Trebbiano',
  'Garganega',
  'Fiano',
  'Falanghina',
  'Cortese',
  'Arneis',
  'Godello',
  'Txakoli',

  // Rosé / sparkling
  'Grenache Rosé',
  'Pinot Meunier',
  'Glera',
] as const

export type GrapeVarietal = (typeof GRAPE_VARIETALS)[number]

/** Set of normalized (lowercase) varietal names for fast lookup */
const VARIETAL_SET = new Set(GRAPE_VARIETALS.map((v) => v.toLowerCase()))

/**
 * Checks whether the given text matches a known grape varietal.
 * Case-insensitive comparison.
 */
export function isKnownVarietal(text: string): boolean {
  return VARIETAL_SET.has(text.trim().toLowerCase())
}

/**
 * Finds a known grape varietal within the given text.
 * Returns the canonical name if found, null otherwise.
 * Searches longest names first to avoid partial matches.
 */
export function findVarietalInText(text: string): string | null {
  const lower = text.toLowerCase()
  // Sort by length descending to match "Cabernet Sauvignon" before "Sauvignon"
  const sorted = [...GRAPE_VARIETALS].sort((a, b) => b.length - a.length)
  for (const varietal of sorted) {
    if (lower.includes(varietal.toLowerCase())) {
      return varietal
    }
  }
  return null
}
