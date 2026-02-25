import { getSLAStatus, worstSLAStatus } from '@/lib/sla/status'

describe('getSLAStatus', () => {
  describe('lowerIsBetter (default)', () => {
    it('returns green when actual <= 80% of target', () => {
      expect(getSLAStatus(5, 10)).toBe('green')
      expect(getSLAStatus(8, 10)).toBe('green')
    })

    it('returns amber when actual is between 80% and 100% of target', () => {
      // target=10, 80% = 8. actual=9 is approaching
      expect(getSLAStatus(9, 10)).toBe('amber')
      expect(getSLAStatus(10, 10)).toBe('amber')
    })

    it('returns red when actual exceeds target', () => {
      expect(getSLAStatus(11, 10)).toBe('red')
      expect(getSLAStatus(100, 10)).toBe('red')
    })
  })

  describe('higherIsBetter', () => {
    it('returns green when actual >= target', () => {
      expect(getSLAStatus(90, 90, false)).toBe('green')
      expect(getSLAStatus(95, 90, false)).toBe('green')
    })

    it('returns amber when actual is within 20% below target', () => {
      // target=100, 80% of target = 80. actual=85 is amber
      expect(getSLAStatus(85, 100, false)).toBe('amber')
      expect(getSLAStatus(80, 100, false)).toBe('amber')
    })

    it('returns red when actual is more than 20% below target', () => {
      // target=100, 80% of target = 80. actual=79 is red
      expect(getSLAStatus(79, 100, false)).toBe('red')
      expect(getSLAStatus(0, 100, false)).toBe('red')
    })
  })
})

describe('worstSLAStatus', () => {
  it('returns red if any status is red', () => {
    expect(worstSLAStatus(['green', 'amber', 'red'])).toBe('red')
    expect(worstSLAStatus(['red'])).toBe('red')
  })

  it('returns amber if worst is amber', () => {
    expect(worstSLAStatus(['green', 'amber'])).toBe('amber')
    expect(worstSLAStatus(['amber', 'amber'])).toBe('amber')
  })

  it('returns green if all are green', () => {
    expect(worstSLAStatus(['green', 'green', 'green'])).toBe('green')
    expect(worstSLAStatus(['green'])).toBe('green')
  })

  it('returns green for empty array', () => {
    expect(worstSLAStatus([])).toBe('green')
  })
})
