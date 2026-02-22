'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/db'
import { applicants } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createApplicantSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be 255 characters or fewer'),
  contactEmail: z
    .string()
    .email('Invalid email address')
    .max(255)
    .optional()
    .or(z.literal('')),
  contactName: z.string().max(255).optional().or(z.literal('')),
  notes: z
    .string()
    .max(2000, 'Notes must be 2,000 characters or fewer')
    .optional()
    .or(z.literal('')),
})

const updateApplicantSchema = createApplicantSchema.extend({
  id: z.string().min(1, 'Applicant ID is required'),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function createApplicant(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    const rawData = {
      companyName: (formData.get('companyName') as string) ?? '',
      contactEmail: (formData.get('contactEmail') as string) || undefined,
      contactName: (formData.get('contactName') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    }

    const parsed = createApplicantSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return {
        success: false,
        error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
      }
    }

    const input = parsed.data

    const [applicant] = await db
      .insert(applicants)
      .values({
        companyName: input.companyName,
        contactEmail: input.contactEmail || null,
        contactName: input.contactName || null,
        notes: input.notes || null,
      })
      .returning({ id: applicants.id })

    revalidatePath('/applicants')

    return { success: true, id: applicant.id }
  } catch (error) {
    console.error('[createApplicant] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while creating the applicant',
    }
  }
}

export async function updateApplicant(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    const rawData = {
      id: (formData.get('id') as string) ?? '',
      companyName: (formData.get('companyName') as string) ?? '',
      contactEmail: (formData.get('contactEmail') as string) || undefined,
      contactName: (formData.get('contactName') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    }

    const parsed = updateApplicantSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return {
        success: false,
        error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
      }
    }

    const input = parsed.data

    // Verify applicant exists
    const [existing] = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(eq(applicants.id, input.id))
      .limit(1)

    if (!existing) {
      return { success: false, error: 'Applicant not found' }
    }

    await db
      .update(applicants)
      .set({
        companyName: input.companyName,
        contactEmail: input.contactEmail || null,
        contactName: input.contactName || null,
        notes: input.notes || null,
      })
      .where(eq(applicants.id, input.id))

    revalidatePath('/applicants')
    revalidatePath(`/applicants/${input.id}`)

    return { success: true, id: input.id }
  } catch (error) {
    console.error('[updateApplicant] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while updating the applicant',
    }
  }
}
