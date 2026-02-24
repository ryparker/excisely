import type { BeverageType } from '@/config/beverage-types'
import { buildClassificationPrompt } from '@/lib/ai/prompts'

describe('buildClassificationPrompt', () => {
  const baseWordList = [
    { index: 0, text: 'Bulleit' },
    { index: 1, text: 'Bourbon' },
  ]

  it('includes mandatory fields for distilled_spirits', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
    )
    expect(prompt).toContain('brand_name')
    expect(prompt).toContain('class_type')
    expect(prompt).toContain('alcohol_content')
    expect(prompt).toContain('net_contents')
    expect(prompt).toContain('health_warning')
    expect(prompt).toContain('name_and_address')
    expect(prompt).toContain('qualifying_phrase')
    // Spirits-specific optional fields
    expect(prompt).toContain('age_statement')
    expect(prompt).toContain('state_of_distillation')
  })

  it('includes mandatory fields for wine', () => {
    const prompt = buildClassificationPrompt('test text', 'wine', baseWordList)
    expect(prompt).toContain('grape_varietal')
    expect(prompt).toContain('appellation_of_origin')
    expect(prompt).toContain('sulfite_declaration')
    expect(prompt).toContain('vintage_year')
  })

  it('includes mandatory fields for malt_beverage', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'malt_beverage',
      baseWordList,
    )
    expect(prompt).toContain('**brand_name** (MANDATORY)')
    expect(prompt).toContain('**class_type** (MANDATORY)')
    expect(prompt).toContain('**net_contents** (MANDATORY)')
    expect(prompt).toContain('**health_warning** (MANDATORY)')
    // Malt beverages should NOT include wine-specific fields as mandatory or optional
    expect(prompt).not.toContain('**grape_varietal**')
    expect(prompt).not.toContain('**appellation_of_origin**')
  })

  it('marks mandatory fields as MANDATORY and optional fields as optional', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
    )
    // brand_name is mandatory for spirits
    expect(prompt).toContain('**brand_name** (MANDATORY)')
    // fanciful_name is optional for spirits
    expect(prompt).toContain('**fanciful_name** (optional)')
  })

  it('includes Application Data section when applicationData is provided', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
      {
        brand_name: 'Bulleit',
        alcohol_content: '45% Alc./Vol.',
      },
    )
    expect(prompt).toContain('Application Data (Form 5100.31)')
    expect(prompt).toContain('Bulleit')
    expect(prompt).toContain('45% Alc./Vol.')
  })

  it('omits Application Data section when applicationData is not provided', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
    )
    expect(prompt).not.toContain('Application Data (Form 5100.31)')
  })

  it('omits Application Data section when applicationData is empty', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
      {},
    )
    expect(prompt).not.toContain('Application Data (Form 5100.31)')
  })

  it('throws for unknown beverage type', () => {
    expect(() =>
      // Intentionally passing invalid type to test runtime error handling
      buildClassificationPrompt(
        'test text',
        'unknown_type' as BeverageType,
        baseWordList,
      ),
    ).toThrow('Unknown beverage type: unknown_type')
  })

  it('escapes regular double quotes in application data values', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
      {
        brand_name: 'Test"Brand"Name',
      },
    )
    // Regular double quotes should be replaced with single quotes
    expect(prompt).not.toContain('Test"Brand"Name')
    expect(prompt).toContain("Test'Brand'Name")
  })

  it('includes the beverage type label in the prompt', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
    )
    expect(prompt).toContain('Distilled Spirits')
  })

  it('includes the word list in numbered format', () => {
    const prompt = buildClassificationPrompt(
      'test text',
      'distilled_spirits',
      baseWordList,
    )
    expect(prompt).toContain('[0] "Bulleit"')
    expect(prompt).toContain('[1] "Bourbon"')
  })

  it('includes the OCR full text', () => {
    const prompt = buildClassificationPrompt(
      'Full OCR text here',
      'wine',
      baseWordList,
    )
    expect(prompt).toContain('Full OCR text here')
  })
})
