'use server'

import { z } from 'zod'

import { updateApplicantNotes as updateApplicantNotesDb } from '@/db/mutations/applicants'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { logActionError } from '@/lib/actions/action-error'
import type { ActionResult } from '@/lib/actions/result-types'

const updateNotesSchema = z.object({
  applicantId: z.string().min(1),
  notes: z.string().max(2000).nullable(),
})

export async function updateApplicantNotes(
  applicantId: string,
  notes: string | null,
): Promise<ActionResult> {
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
    return logActionError('updateApplicantNotes', error, 'Failed to save notes')
  }
}
