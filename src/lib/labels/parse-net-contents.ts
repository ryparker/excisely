/** Parse a net contents string (e.g. "750 mL", "25.4 FL OZ", "1 L") to mL */
export function parseNetContentsToMl(text: string): number | null {
  const cleaned = text.trim().toLowerCase()

  // Try "NNN mL" or "NNN ml"
  const mlMatch = cleaned.match(/([\d,.]+)\s*ml/)
  if (mlMatch) {
    const val = parseFloat(mlMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val) : null
  }

  // Try "N L" or "N liter(s)"
  const literMatch = cleaned.match(/([\d,.]+)\s*(?:l(?:iter)?s?\b)/)
  if (literMatch) {
    const val = parseFloat(literMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1000) : null
  }

  // Try "N FL OZ" or "N fl. oz."
  const ozMatch = cleaned.match(/([\d,.]+)\s*(?:fl\.?\s*oz\.?)/)
  if (ozMatch) {
    const val = parseFloat(ozMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val * 29.5735) : null
  }

  // Try bare number (assume mL)
  const bareMatch = cleaned.match(/^([\d,.]+)$/)
  if (bareMatch) {
    const val = parseFloat(bareMatch[1].replace(',', ''))
    return Number.isFinite(val) && val > 0 ? Math.round(val) : null
  }

  return null
}
