import { cacheLife, cacheTag } from 'next/cache'

/**
 * Check whether both Cloud AI API keys (Google Cloud Vision + OpenAI) are configured.
 * Server-only — reads process.env at runtime.
 */
export function hasCloudApiKeys(): boolean {
  const hasGoogle =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  return hasGoogle && hasOpenAI
}

/**
 * Detailed cloud API availability status for the Settings UI.
 * Cached for hours since env vars don't change at runtime.
 */
export async function getCloudApiStatus(): Promise<{
  available: boolean
  missing: string[]
}> {
  'use cache'
  cacheTag('cloud-status')
  cacheLife('hours')

  const missing: string[] = []

  const hasGoogle =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!hasGoogle) {
    missing.push('GOOGLE_APPLICATION_CREDENTIALS')
  }

  if (!process.env.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY')
  }

  return { available: missing.length === 0, missing }
}
