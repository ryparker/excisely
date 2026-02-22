'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { settings } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

const updateConfidenceSchema = z.object({
  confidenceThreshold: z.number().min(0).max(100),
})

const updateStrictnessSchema = z.object({
  fieldStrictness: z.record(
    z.string(),
    z.enum(['strict', 'moderate', 'lenient']),
  ),
})

type UpdateSettingsResult =
  | { success: true }
  | { success: false; error: string }

async function upsertSetting(key: string, value: unknown): Promise<void> {
  const [existing] = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value })
  }
}

export async function updateConfidenceThreshold(
  threshold: number,
): Promise<UpdateSettingsResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  const parsed = updateConfidenceSchema.safeParse({
    confidenceThreshold: threshold,
  })
  if (!parsed.success) {
    return { success: false, error: 'Threshold must be between 0 and 100' }
  }

  try {
    await upsertSetting('confidence_threshold', parsed.data.confidenceThreshold)
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('[updateConfidenceThreshold] Error:', error)
    return { success: false, error: 'Failed to save threshold' }
  }
}

export async function updateFieldStrictness(
  fieldStrictness: Record<string, string>,
): Promise<UpdateSettingsResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role !== 'admin') {
    return { success: false, error: 'Admin access required' }
  }

  const parsed = updateStrictnessSchema.safeParse({ fieldStrictness })
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid strictness values. Must be strict, moderate, or lenient.',
    }
  }

  try {
    await upsertSetting('field_strictness', parsed.data.fieldStrictness)
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('[updateFieldStrictness] Error:', error)
    return { success: false, error: 'Failed to save field strictness' }
  }
}
