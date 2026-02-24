import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { applicants } from '@/db/schema'

// ---------------------------------------------------------------------------
// updateApplicantNotes
// ---------------------------------------------------------------------------

export async function updateApplicantNotes(
  applicantId: string,
  notes: string | null,
) {
  await db
    .update(applicants)
    .set({ notes })
    .where(eq(applicants.id, applicantId))
}
