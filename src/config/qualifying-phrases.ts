/**
 * TTB qualifying phrases for the Name and Address statement (Item 8).
 *
 * These are NOT a strict enum — the regulation uses "appropriate phrase such as…"
 * language and allows compound phrases when one entity performs multiple functions
 * (27 CFR 5.66(b), 7.66(b), 4.26). This list covers the standard phrases that
 * appear in the CFR and TTB guidance documents.
 *
 * @see https://www.law.cornell.edu/cfr/text/27/5.66 — Distilled spirits
 * @see https://www.law.cornell.edu/cfr/text/27/7.66 — Malt beverages
 * @see https://www.law.cornell.edu/cfr/text/27/4.26 — Wine (estate bottled)
 */
export const QUALIFYING_PHRASES = [
  // Single-function phrases
  'Bottled by',
  'Packed by',
  'Distilled by',
  'Blended by',
  'Produced by',
  'Prepared by',
  'Made by',
  'Manufactured by',
  'Imported by',
  'Brewed by',
  // Compound phrases (entity performs multiple functions)
  'Distilled and Bottled by',
  'Produced and Bottled by',
  'Cellared and Bottled by',
  'Vinted and Bottled by',
  'Prepared and Bottled by',
  'Brewed and Bottled by',
  'Brewed and Packaged by',
  'Imported and Bottled by',
  // Contract/third-party bottling
  'Bottled for',
  'Distilled by and Bottled for',
  'Brewed and Bottled for',
  // Wine-specific
  'Estate Bottled',
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
