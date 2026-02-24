'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { applicants } from '@/db/schema'
import { guardSpecialist } from '@/lib/auth/action-guards'

const updateNotesSchema = z.object({
  applicantId: z.string().min(1),
  notes: z.string().max(2000).nullable(),
})

type UpdateNotesResult = { success: true } | { success: false; error: string }

export async function updateApplicantNotes(
  applicantId: string,
  notes: string | null,
): Promise<UpdateNotesResult> {
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  const parsed = updateNotesSchema.safeParse({ applicantId, notes })
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' }
  }

  try {
    const trimmed = parsed.data.notes?.trim() || null
    await db
      .update(applicants)
      .set({ notes: trimmed })
      .where(eq(applicants.id, parsed.data.applicantId))
    return { success: true }
  } catch (error) {
    console.error('[updateApplicantNotes] Error:', error)
    return { success: false, error: 'Failed to save notes' }
  }
}
