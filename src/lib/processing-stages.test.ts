import {
  STAGES,
  getScaledTimings,
  getStageCumulativeDelays,
  getTimeEstimateLabel,
} from '@/lib/processing-stages'

// ---------------------------------------------------------------------------
// getScaledTimings
// ---------------------------------------------------------------------------

describe('getScaledTimings', () => {
  it('returns base timings for a single image', () => {
    const { stages, totalEstimatedMs } = getScaledTimings(1)
    expect(stages).toHaveLength(STAGES.length)
    // Single image: each stage uses baseEstimatedMs only
    for (const stage of stages) {
      const base = STAGES.find((s) => s.id === stage.id)!
      expect(stage.estimatedMs).toBe(base.baseEstimatedMs)
    }
    const expectedTotal = STAGES.reduce((sum, s) => sum + s.baseEstimatedMs, 0)
    expect(totalEstimatedMs).toBe(expectedTotal)
  })

  it('scales timings for multiple images', () => {
    const { stages } = getScaledTimings(3)
    // 3 images = base + 2 * perImageMs
    for (const stage of stages) {
      const base = STAGES.find((s) => s.id === stage.id)!
      expect(stage.estimatedMs).toBe(base.baseEstimatedMs + 2 * base.perImageMs)
    }
  })

  it('calculates correct totalEstimatedMs', () => {
    const { stages, totalEstimatedMs } = getScaledTimings(2)
    const sum = stages.reduce((acc, s) => acc + s.estimatedMs, 0)
    expect(totalEstimatedMs).toBe(sum)
  })

  it('defaults to 1 image when called without arguments', () => {
    const noArgs = getScaledTimings()
    const oneImage = getScaledTimings(1)
    expect(noArgs.totalEstimatedMs).toBe(oneImage.totalEstimatedMs)
  })

  it('treats 0 or negative imageCount as 1', () => {
    const zero = getScaledTimings(0)
    const one = getScaledTimings(1)
    expect(zero.totalEstimatedMs).toBe(one.totalEstimatedMs)
  })
})

// ---------------------------------------------------------------------------
// getStageCumulativeDelays
// ---------------------------------------------------------------------------

describe('getStageCumulativeDelays', () => {
  it('returns correct number of entries', () => {
    const delays = getStageCumulativeDelays(1)
    expect(delays).toHaveLength(STAGES.length)
  })

  it('first stage starts at delay 0', () => {
    const delays = getStageCumulativeDelays(1)
    expect(delays[0].delay).toBe(0)
    expect(delays[0].stageId).toBe('uploading')
  })

  it('cumulative delays accumulate correctly', () => {
    const delays = getStageCumulativeDelays(1)
    const { stages } = getScaledTimings(1)

    let cumulative = 0
    for (let i = 0; i < delays.length; i++) {
      expect(delays[i].delay).toBe(cumulative)
      cumulative += stages[i].estimatedMs
    }
  })

  it('scales delays with multiple images', () => {
    const delays1 = getStageCumulativeDelays(1)
    const delays3 = getStageCumulativeDelays(3)

    // With more images, later stages should have larger cumulative delays
    // (unless all perImageMs are 0, which isn't the case for early stages)
    const lastDelay1 = delays1[delays1.length - 1].delay
    const lastDelay3 = delays3[delays3.length - 1].delay
    expect(lastDelay3).toBeGreaterThan(lastDelay1)
  })
})

// ---------------------------------------------------------------------------
// getTimeEstimateLabel
// ---------------------------------------------------------------------------

describe('getTimeEstimateLabel', () => {
  it('returns a formatted string with en-dash separator', () => {
    const label = getTimeEstimateLabel(1)
    expect(label).toMatch(/^\d+\u2013\d+ seconds$/)
  })

  it('returns higher estimate for more images', () => {
    const label1 = getTimeEstimateLabel(1)
    const label5 = getTimeEstimateLabel(5)

    // Extract the high-end seconds from each label
    const high1 = parseInt(label1.split('\u2013')[1])
    const high5 = parseInt(label5.split('\u2013')[1])
    expect(high5).toBeGreaterThan(high1)
  })

  it('low bound is at least 1 second', () => {
    const label = getTimeEstimateLabel(1)
    const low = parseInt(label.split('\u2013')[0])
    expect(low).toBeGreaterThanOrEqual(1)
  })
})
