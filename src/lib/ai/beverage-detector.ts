import type { BeverageType } from '@/config/beverage-types'

// ---------------------------------------------------------------------------
// Keyword-based beverage type detection from OCR text
// ---------------------------------------------------------------------------

/** Keywords that strongly indicate each beverage type */
export const BEVERAGE_TYPE_KEYWORDS: Record<BeverageType, string[]> = {
  distilled_spirits: [
    'whiskey',
    'whisky',
    'bourbon',
    'vodka',
    'gin',
    'rum',
    'tequila',
    'mezcal',
    'brandy',
    'cognac',
    'scotch',
    'proof',
    'distilled by',
    'distilled from',
    'blended whiskey',
    'straight bourbon',
    'single malt',
    'rye whiskey',
    'corn whiskey',
    'liqueur',
    'cordial',
    'absinthe',
    'schnapps',
    'grappa',
    'pisco',
    'soju',
    'shochu',
    'baijiu',
    'aquavit',
    'moonshine',
  ],
  wine: [
    'wine',
    'cabernet',
    'chardonnay',
    'merlot',
    'pinot',
    'sauvignon',
    'riesling',
    'zinfandel',
    'syrah',
    'shiraz',
    'malbec',
    'tempranillo',
    'sangiovese',
    'moscato',
    'prosecco',
    'champagne',
    'vintage',
    'sulfites',
    'contains sulfites',
    'appellation',
    'vineyard',
    'estate bottled',
    'vinted by',
    'cellared by',
    'produced and bottled',
    'viognier',
    'gewurztraminer',
    'grenache',
    'ros\u00e9',
    'rose',
    'sparkling',
    'varietal',
    'cuv\u00e9e',
    'cuvee',
    'sommelier',
    'terroir',
  ],
  malt_beverage: [
    'ale',
    'lager',
    'beer',
    'stout',
    'ipa',
    'porter',
    'pilsner',
    'brewed by',
    'brewed with',
    'brewing',
    'brewery',
    'craft beer',
    'wheat beer',
    'hefeweizen',
    'pale ale',
    'amber ale',
    'brown ale',
    'sour ale',
    'session ale',
    'double ipa',
    'imperial stout',
    'hard seltzer',
    'hard cider',
    'malt liquor',
    'malt beverage',
    'flavored malt',
    'hops',
    'barley',
    'saison',
    'gose',
    'k\u00f6lsch',
    'kolsch',
    'bock',
    'dunkel',
    'm\u00e4rzen',
    'marzen',
  ],
}

/**
 * Detects the beverage type from OCR text using keyword matching.
 * Pure CPU -- no LLM call. Runs in <1ms.
 *
 * Scores each type by counting keyword hits in the text.
 * Returns the winner if it has at least 1 more hit than the runner-up.
 * Returns null if ambiguous or no keywords found.
 */
export function detectBeverageTypeFromText(
  ocrText: string,
): BeverageType | null {
  const lowerText = ocrText.toLowerCase()

  const scores: Record<BeverageType, number> = {
    distilled_spirits: 0,
    wine: 0,
    malt_beverage: 0,
  }

  const beverageTypes = Object.keys(BEVERAGE_TYPE_KEYWORDS) as BeverageType[]
  for (const type of beverageTypes) {
    for (const keyword of BEVERAGE_TYPE_KEYWORDS[type]) {
      if (lowerText.includes(keyword)) {
        scores[type]++
      }
    }
  }

  // Find the winner
  const entries = beverageTypes.map((t) => [t, scores[t]] as const)
  entries.sort((a, b) => b[1] - a[1])

  const [winner, winnerScore] = entries[0]
  const runnerUpScore = entries[1][1]

  // Need at least 1 hit and a clear lead (1+ more than runner-up)
  if (winnerScore === 0) return null
  if (winnerScore - runnerUpScore < 1) return null

  return winner
}
