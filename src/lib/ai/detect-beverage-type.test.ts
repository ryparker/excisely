import { describe, expect, it } from 'vitest'

import { detectBeverageTypeFromText } from '@/lib/ai/extract-label'

describe('detectBeverageTypeFromText', () => {
  // -----------------------------------------------------------------------
  // Clear detections — single type dominates
  // -----------------------------------------------------------------------

  it('detects distilled spirits from whiskey keywords', () => {
    const ocrText = `
      KNOB CREEK
      Kentucky Straight Bourbon Whiskey
      100 Proof
      Distilled by Beam Suntory Inc
      750 mL
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('distilled_spirits')
  })

  it('detects wine from varietal and sulfite keywords', () => {
    const ocrText = `
      OPUS ONE
      2019 Napa Valley Red Wine
      Cabernet Sauvignon
      Contains Sulfites
      Appellation Napa Valley
      Produced and Bottled by Opus One Winery
      750 mL  14.5% Alc/Vol
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('wine')
  })

  it('detects malt beverage from beer keywords', () => {
    const ocrText = `
      SIERRA NEVADA
      Pale Ale
      Brewed by Sierra Nevada Brewing Co
      Chico, California
      12 FL OZ  5.6% Alc/Vol
      Hops
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('malt_beverage')
  })

  it('detects spirits from vodka label', () => {
    const ocrText = `
      TITO'S HANDMADE VODKA
      80 Proof  40% Alc/Vol
      Distilled from Corn
      Austin, Texas
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('distilled_spirits')
  })

  it('detects wine from champagne/sparkling keywords', () => {
    const ocrText = `
      VEUVE CLICQUOT
      Champagne Brut
      Contains Sulfites
      750 mL  12% Alc/Vol
      Produced by Veuve Clicquot Ponsardin
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('wine')
  })

  it('detects malt beverage from IPA label', () => {
    const ocrText = `
      LAGUNITAS
      IPA
      India Pale Ale
      Brewed with cascade hops
      Petaluma, California Brewery
      12 FL OZ
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('malt_beverage')
  })

  // -----------------------------------------------------------------------
  // Ambiguous / no keywords
  // -----------------------------------------------------------------------

  it('returns null when no keywords found', () => {
    const ocrText = `
      SOME BRAND NAME
      750 mL
      12% Alc/Vol
      Produced by Some Company
      New York, NY
    `
    expect(detectBeverageTypeFromText(ocrText)).toBeNull()
  })

  it('returns null for empty text', () => {
    expect(detectBeverageTypeFromText('')).toBeNull()
  })

  it('returns null when scores are tied', () => {
    // One keyword for spirits ("proof") and one for wine ("wine")
    const ocrText = `
      SOME PRODUCT
      Wine 100 Proof
    `
    expect(detectBeverageTypeFromText(ocrText)).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Case insensitivity
  // -----------------------------------------------------------------------

  it('is case-insensitive', () => {
    const ocrText = 'KENTUCKY STRAIGHT BOURBON WHISKEY 100 PROOF DISTILLED BY'
    expect(detectBeverageTypeFromText(ocrText)).toBe('distilled_spirits')
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles multi-image OCR text with image separators', () => {
    const ocrText = `
      --- Image 1 ---
      JACK DANIEL'S
      Old No. 7
      Tennessee Whiskey

      --- Image 2 ---
      Distilled by Jack Daniel Distillery
      Lynchburg, Tennessee
      80 Proof  40% Alc/Vol
      GOVERNMENT WARNING
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('distilled_spirits')
  })

  it('detects correct type when minority keywords from other types exist', () => {
    // Wine with a mention of "ale" in "Bale" (substring match consideration)
    // But "wine", "vineyard", "vintage", "sulfites" should dominate
    const ocrText = `
      STAG'S LEAP WINE CELLARS
      Cabernet Sauvignon
      Napa Valley Vineyard
      Vintage 2018
      Contains Sulfites
      Estate Bottled
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('wine')
  })

  it('handles rum correctly as spirits', () => {
    const ocrText = `
      BACARDI
      Superior White Rum
      750 mL  40% Alc/Vol
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('distilled_spirits')
  })

  it('handles hard seltzer as malt beverage', () => {
    const ocrText = `
      WHITE CLAW
      Hard Seltzer
      Malt Beverage with Natural Flavors
      12 FL OZ  5% Alc/Vol
    `
    expect(detectBeverageTypeFromText(ocrText)).toBe('malt_beverage')
  })
})
