import {
  QUALIFYING_PHRASES,
  isValidQualifyingPhrase,
} from '@/config/qualifying-phrases'

describe('QUALIFYING_PHRASES', () => {
  it('contains expected phrases', () => {
    expect(QUALIFYING_PHRASES).toContain('Bottled by')
    expect(QUALIFYING_PHRASES).toContain('Distilled by')
    expect(QUALIFYING_PHRASES).toContain('Brewed and Bottled by')
  })
})

describe('isValidQualifyingPhrase', () => {
  it('returns true for a valid phrase', () => {
    expect(isValidQualifyingPhrase('Bottled by')).toBe(true)
    expect(isValidQualifyingPhrase('Distilled by')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isValidQualifyingPhrase('bottled by')).toBe(true)
    expect(isValidQualifyingPhrase('BOTTLED BY')).toBe(true)
    expect(isValidQualifyingPhrase('Brewed And Bottled By')).toBe(true)
  })

  it('returns false for invalid phrases', () => {
    expect(isValidQualifyingPhrase('Crafted by')).toBe(false)
    expect(isValidQualifyingPhrase('Created by')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidQualifyingPhrase('')).toBe(false)
  })

  it('trims whitespace before matching', () => {
    expect(isValidQualifyingPhrase('  Bottled by  ')).toBe(true)
  })
})
