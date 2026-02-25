import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type OpenAI from 'openai'
import {
  isLlmAvailable,
  llmExtractFields,
  _setClient,
} from '@/lib/ai/openai-extract'

// ---------------------------------------------------------------------------
// Mock client factory
// ---------------------------------------------------------------------------

function createMockClient(mockCreate: ReturnType<typeof vi.fn>) {
  return {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  } as unknown as OpenAI
}

function makeLlmResponse(
  fields: Array<{
    fieldName: string
    value: string | null
    confidence: number
    reasoning: string | null
  }>,
  detectedBeverageType: string | null = null,
) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ fields, detectedBeverageType }),
        },
      },
    ],
    usage: {
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isLlmAvailable', () => {
  const originalEnv = process.env.OPENAI_API_KEY

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv
    } else {
      delete process.env.OPENAI_API_KEY
    }
  })

  it('returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key'
    expect(isLlmAvailable()).toBe(true)
  })

  it('returns false when OPENAI_API_KEY is empty string', () => {
    process.env.OPENAI_API_KEY = ''
    expect(isLlmAvailable()).toBe(false)
  })

  it('returns false when OPENAI_API_KEY is not set', () => {
    delete process.env.OPENAI_API_KEY
    expect(isLlmAvailable()).toBe(false)
  })
})

describe('llmExtractFields', () => {
  const originalEnv = process.env.OPENAI_API_KEY
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreate = vi.fn()
    _setClient(createMockClient(mockCreate))
    process.env.OPENAI_API_KEY = 'sk-test-key'
  })

  afterEach(() => {
    _setClient(null)
    if (originalEnv !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv
    } else {
      delete process.env.OPENAI_API_KEY
    }
  })

  it('parses a valid GPT response into ClassificationResponse', async () => {
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse(
        [
          {
            fieldName: 'brand_name',
            value: 'Old Tom',
            confidence: 95,
            reasoning: 'Largest text on front label.',
          },
          {
            fieldName: 'alcohol_content',
            value: '40% Alc./Vol.',
            confidence: 90,
            reasoning: 'Clear pattern match.',
          },
          {
            fieldName: 'fanciful_name',
            value: null,
            confidence: 0,
            reasoning: 'No fanciful name present.',
          },
        ],
        'distilled_spirits',
      ),
    )

    const result = await llmExtractFields(
      'OLD TOM 40% Alc./Vol. 750 mL',
      'distilled_spirits',
    )

    expect(result.result.fields).toHaveLength(3)
    expect(result.result.fields[0]).toEqual({
      fieldName: 'brand_name',
      value: 'Old Tom',
      confidence: 95,
      wordIndices: [],
      reasoning: 'Largest text on front label.',
    })
    expect(result.result.detectedBeverageType).toBe('distilled_spirits')
    expect(result.usage.totalTokens).toBe(700)
    expect(result.usage.inputTokens).toBe(500)
    expect(result.usage.outputTokens).toBe(200)
  })

  it('passes beverage-type-specific fields when type is known', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse([]))

    await llmExtractFields('some text', 'wine')

    const callArgs = mockCreate.mock.calls[0][0]
    const userMessage = callArgs.messages[1].content
    // Wine-specific fields should be mentioned
    expect(userMessage).toContain('grape_varietal')
    expect(userMessage).toContain('appellation_of_origin')
    expect(userMessage).toContain('sulfite_declaration')
    // Spirits-only fields should NOT be mentioned
    expect(userMessage).not.toContain('age_statement')
    expect(userMessage).not.toContain('state_of_distillation')
  })

  it('includes all fields when beverage type is null', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse([]))

    await llmExtractFields('some text', null)

    const callArgs = mockCreate.mock.calls[0][0]
    const userMessage = callArgs.messages[1].content
    // Should include fields from all types
    expect(userMessage).toContain('brand_name')
    expect(userMessage).toContain('grape_varietal')
    expect(userMessage).toContain('age_statement')
  })

  it('uses gpt-4.1-mini with temperature 0 and json_object format', async () => {
    mockCreate.mockResolvedValueOnce(makeLlmResponse([]))

    await llmExtractFields('text', 'distilled_spirits')

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-4.1-mini')
    expect(callArgs.temperature).toBe(0)
    expect(callArgs.response_format).toEqual({ type: 'json_object' })
  })

  it('throws on invalid JSON from LLM', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not valid json' } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    })

    await expect(
      llmExtractFields('text', 'distilled_spirits'),
    ).rejects.toThrow()
  })

  it('throws on empty response from LLM', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    })

    await expect(
      llmExtractFields('text', 'distilled_spirits'),
    ).rejects.toThrow('GPT-4.1-mini returned empty response')
  })

  it('rejects response with invalid field schema (confidence out of range)', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: [
                {
                  fieldName: 'brand_name',
                  value: 'Test',
                  confidence: 150,
                  reasoning: null,
                },
              ],
            }),
          },
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    })

    await expect(
      llmExtractFields('text', 'distilled_spirits'),
    ).rejects.toThrow()
  })

  it('handles missing usage gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              fields: [],
              detectedBeverageType: null,
            }),
          },
        },
      ],
      usage: undefined,
    })

    const result = await llmExtractFields('text', null)
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })
  })
})
