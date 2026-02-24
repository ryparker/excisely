/**
 * Simple English pluralization for regular nouns (adds "s").
 *
 * @example
 * pluralize(3, 'label')                    // "3 labels"
 * pluralize(1, 'label')                    // "1 label"
 * pluralize(0, 'label')                    // "0 labels"
 * pluralize(5, 'day', { omitCount: true }) // "days"
 * pluralize(1, 'day', { omitCount: true }) // "day"
 */
export function pluralize(
  count: number,
  singular: string,
  opts?: { omitCount?: boolean },
): string {
  const word = count === 1 ? singular : `${singular}s`
  return opts?.omitCount ? word : `${count} ${word}`
}
