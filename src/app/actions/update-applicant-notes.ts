'use server'

import { z } from 'zod'

import { updateApplicantNotes as updateApplicantNotesDb } from '@/db/mutations/applicants'
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
    await updateApplicantNotesDb(parsed.data.applicantId, trimmed)
    return { success: true }
  } catch (error) {
    console.error('[updateApplicantNotes] Error:', error)
    return { success: false, error: 'Failed to save notes' }
  }
}
