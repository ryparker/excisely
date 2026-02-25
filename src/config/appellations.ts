/**
 * Common American Viticultural Areas (AVAs) and state appellations
 * found on TTB-regulated wine labels.
 *
 * Used by the rule-based classifier to identify appellation_of_origin
 * fields in OCR text without requiring an LLM. Covers major AVAs
 * and state-level appellations appearing on US-market wines.
 *
 * @see https://www.ttb.gov/wine/american-viticultural-areas
 */
export const APPELLATIONS = [
  // California AVAs
  'Napa Valley',
  'Sonoma Coast',
  'Sonoma County',
  'Russian River Valley',
  'Alexander Valley',
  'Dry Creek Valley',
  'Paso Robles',
  'Santa Barbara County',
  'Santa Ynez Valley',
  'Sta. Rita Hills',
  'Central Coast',
  'North Coast',
  'Lodi',
  'Sierra Foothills',
  'Livermore Valley',
  'Monterey',
  'Santa Lucia Highlands',
  'Anderson Valley',
  'Mendocino',
  'Carneros',
  'Los Carneros',
  'Oakville',
  'Rutherford',
  'Stags Leap District',
  'Howell Mountain',
  'Atlas Peak',
  'Mount Veeder',
  'Spring Mountain District',
  'Calistoga',
  'Diamond Mountain District',
  'Temecula Valley',

  // Oregon AVAs
  'Willamette Valley',
  'Dundee Hills',
  'Eola-Amity Hills',
  'Chehalem Mountains',
  'Ribbon Ridge',
  'Umpqua Valley',
  'Rogue Valley',

  // Washington AVAs
  'Columbia Valley',
  'Walla Walla Valley',
  'Yakima Valley',
  'Red Mountain',
  'Horse Heaven Hills',
  'Wahluke Slope',

  // Other US AVAs
  'Finger Lakes',
  'Long Island',
  'Virginia',
  'Texas Hill Country',
  'Snake River Valley',

  // State-level appellations
  'California',
  'Oregon',
  'Washington',
  'New York',
  'American',

  // International (common on US imports)
  'Bordeaux',
  'Burgundy',
  'Champagne',
  'Côtes du Rhône',
  'Cotes du Rhone',
  'Loire Valley',
  'Alsace',
  'Languedoc',
  'Provence',
  'Tuscany',
  'Piedmont',
  'Rioja',
  'Ribera del Duero',
  'Barossa Valley',
  'McLaren Vale',
  'Marlborough',
  'Stellenbosch',
  'Mendoza',
] as const

export type Appellation = (typeof APPELLATIONS)[number]

/** Set of normalized (lowercase) appellation names for fast lookup */
const APPELLATION_SET = new Set(APPELLATIONS.map((a) => a.toLowerCase()))

/**
 * Checks whether the given text matches a known appellation.
 * Case-insensitive comparison.
 */
export function isKnownAppellation(text: string): boolean {
  return APPELLATION_SET.has(text.trim().toLowerCase())
}

/**
 * Finds a known appellation within the given text.
 * Returns the canonical name if found, null otherwise.
 * Searches longest names first to avoid partial matches.
 */
export function findAppellationInText(text: string): string | null {
  const lower = text.toLowerCase()
  // Sort by length descending to match "Stags Leap District" before "Napa Valley"
  const sorted = [...APPELLATIONS].sort((a, b) => b.length - a.length)
  for (const appellation of sorted) {
    if (lower.includes(appellation.toLowerCase())) {
      return appellation
    }
  }
  return null
}
