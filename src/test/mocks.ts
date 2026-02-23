import { vi } from 'vitest'

import { createSession, type MockSession } from './factories'
import type { ExtractionResult } from '@/lib/ai/extract-label'

// ---------------------------------------------------------------------------
// Auth — mock getSession
// ---------------------------------------------------------------------------

/**
 * Mocks `@/lib/auth/get-session` to return the provided session.
 * Defaults to a specialist session if no argument is provided.
 * Pass `null` to simulate unauthenticated state.
 */
export function mockGetSession(session?: MockSession | null) {
  const resolved = session === undefined ? createSession() : session
  vi.mock('@/lib/auth/get-session', () => ({
    getSession: vi.fn().mockResolvedValue(resolved),
  }))
  return resolved
}

// ---------------------------------------------------------------------------
// DB — chainable query builder stubs
// ---------------------------------------------------------------------------

type ChainableStub = Record<string, ReturnType<typeof vi.fn>>

function createChain(resolvedValue: unknown = []): ChainableStub {
  const chain: ChainableStub = {}

  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'orderBy',
    'into',
    'set',
    'values',
    'returning',
    'insert',
    'update',
    'delete',
    'then',
  ]

  for (const method of methods) {
    if (method === 'then') {
      // Make the chain thenable so `await` resolves to the value
      chain[method] = vi.fn().mockImplementation((resolve) => {
        return Promise.resolve(resolvedValue).then(resolve)
      })
    } else {
      chain[method] = vi.fn().mockReturnValue(chain)
    }
  }

  return chain
}

export interface MockDb {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
  _selectChain: ChainableStub
  _insertChain: ChainableStub
  _updateChain: ChainableStub
  _deleteChain: ChainableStub
}

/**
 * Mocks `@/db` with chainable query builder stubs.
 *
 * Usage:
 * ```ts
 * const mockDatabase = mockDb()
 * // Configure a select to return specific rows:
 * mockDatabase._selectChain.then.mockImplementation((resolve) =>
 *   Promise.resolve([someLabel]).then(resolve)
 * )
 * ```
 */
export function mockDb(): MockDb {
  const selectChain = createChain([])
  const insertChain = createChain([])
  const updateChain = createChain([])
  const deleteChain = createChain([])

  const database: MockDb = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    transaction: vi.fn().mockImplementation(async (fn) => fn(database)),
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
    _deleteChain: deleteChain,
  }

  vi.mock('@/db', () => ({
    db: database,
  }))

  return database
}

// ---------------------------------------------------------------------------
// AI Pipeline — mock extractLabelFields
// ---------------------------------------------------------------------------

const DEFAULT_EXTRACTION_RESULT: ExtractionResult = {
  fields: [
    {
      fieldName: 'brand_name',
      value: 'Old Tom Reserve',
      confidence: 95,
      reasoning: 'Clearly visible on label',
      boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.05 },
      imageIndex: 0,
    },
  ],
  imageClassifications: [{ imageIndex: 0, imageType: 'front', confidence: 98 }],
  processingTimeMs: 2500,
  modelUsed: 'gpt-5-mini',
  rawResponse: { classification: {}, usage: {}, metrics: {} },
  metrics: {
    fetchTimeMs: 200,
    ocrTimeMs: 800,
    classificationTimeMs: 1200,
    mergeTimeMs: 50,
    totalTimeMs: 2500,
    wordCount: 120,
    imageCount: 1,
    inputTokens: 500,
    outputTokens: 300,
    totalTokens: 800,
  },
}

/**
 * Mocks `@/lib/ai/extract-label` to return the provided extraction result
 * or a realistic default.
 */
export function mockExtractLabelFields(result?: Partial<ExtractionResult>) {
  const resolved = { ...DEFAULT_EXTRACTION_RESULT, ...result }
  vi.mock('@/lib/ai/extract-label', () => ({
    extractLabelFields: vi.fn().mockResolvedValue(resolved),
  }))
  return resolved
}

// ---------------------------------------------------------------------------
// Next.js Cache — mock revalidatePath
// ---------------------------------------------------------------------------

/**
 * Mocks `next/cache` revalidatePath as a no-op.
 */
export function mockRevalidatePath() {
  const revalidatePathFn = vi.fn()
  vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathFn,
  }))
  return revalidatePathFn
}
