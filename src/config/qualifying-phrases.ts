export const QUALIFYING_PHRASES = [
  'Bottled by',
  'Distilled by',
  'Blended by',
  'Produced by',
  'Made by',
  'Manufactured by',
  'Imported by',
  'Cellared and Bottled by',
  'Vinted and Bottled by',
  'Prepared and Bottled by',
  'Brewed by',
  'Brewed and Bottled by',
] as const

export type QualifyingPhrase = (typeof QUALIFYING_PHRASES)[number]

/**
 * Checks whether the given text matches a valid TTB qualifying phrase.
 * Comparison is case-insensitive.
 */
export function isValidQualifyingPhrase(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return QUALIFYING_PHRASES.some(
    (phrase) => phrase.toLowerCase() === normalized,
  )
}
