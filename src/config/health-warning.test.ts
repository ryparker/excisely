import {
  HEALTH_WARNING_FULL,
  HEALTH_WARNING_PREFIX,
  HEALTH_WARNING_SECTION_1,
  HEALTH_WARNING_SECTION_2,
  isValidHealthWarning,
} from '@/config/health-warning'

describe('health warning constants', () => {
  it('prefix is uppercase GOVERNMENT WARNING:', () => {
    expect(HEALTH_WARNING_PREFIX).toBe('GOVERNMENT WARNING:')
  })

  it('full text combines prefix with both sections', () => {
    expect(HEALTH_WARNING_FULL).toBe(
      `GOVERNMENT WARNING: ${HEALTH_WARNING_SECTION_1} ${HEALTH_WARNING_SECTION_2}`,
    )
  })
})

describe('isValidHealthWarning', () => {
  it('returns valid for exact match', () => {
    const result = isValidHealthWarning(HEALTH_WARNING_FULL)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('normalizes extra whitespace in body text', () => {
    // Prefix must remain intact, but body whitespace is normalized
    const bodyWithExtraSpaces =
      'GOVERNMENT WARNING: ' +
      HEALTH_WARNING_SECTION_1.replace(/ /g, '  ') +
      '  ' +
      HEALTH_WARNING_SECTION_2.replace(/ /g, '  ')
    const result = isValidHealthWarning(bodyWithExtraSpaces)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('reports issue when prefix is lowercase', () => {
    const lowered = HEALTH_WARNING_FULL.replace(
      'GOVERNMENT WARNING:',
      'government warning:',
    )
    const result = isValidHealthWarning(lowered)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.stringContaining('ALL CAPS'))
  })

  it('reports missing prefix when entirely absent', () => {
    const noPrefix = HEALTH_WARNING_FULL.replace('GOVERNMENT WARNING: ', '')
    const result = isValidHealthWarning(noPrefix)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.stringContaining('prefix'))
  })

  it('reports missing section 1', () => {
    const text = `GOVERNMENT WARNING: ${HEALTH_WARNING_SECTION_2}`
    const result = isValidHealthWarning(text)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.stringContaining('section (1)'))
  })

  it('reports missing section 2', () => {
    const text = `GOVERNMENT WARNING: ${HEALTH_WARNING_SECTION_1}`
    const result = isValidHealthWarning(text)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.stringContaining('section (2)'))
  })

  it('returns invalid with issue for empty string', () => {
    const result = isValidHealthWarning('')
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.stringContaining('empty'))
  })

  it('detects subtle text differences', () => {
    const altered = HEALTH_WARNING_FULL.replace(
      'birth defects',
      'health issues',
    )
    const result = isValidHealthWarning(altered)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('trims leading/trailing whitespace', () => {
    const result = isValidHealthWarning(`  ${HEALTH_WARNING_FULL}  `)
    expect(result.valid).toBe(true)
  })
})
