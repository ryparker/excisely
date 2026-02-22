const HTML_TAG_PATTERN = /<[^>]*>/g

/**
 * Strips HTML tags and trims whitespace from user input.
 */
export function sanitizeString(input: string): string {
  return input.replace(HTML_TAG_PATTERN, '').trim()
}

/**
 * Sanitizes a URL search param value. Returns empty string for null/undefined.
 */
export function sanitizeSearchParam(param: string | null): string {
  if (!param) return ''
  return sanitizeString(decodeURIComponent(param))
}
