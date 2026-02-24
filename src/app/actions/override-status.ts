'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/db'
import { labels, statusOverrides } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const overrideStatusSchema = z.object({
  labelId: z.string().min(1),
  newStatus: z.enum([
    'approved',
    'conditionally_approved',
    'needs_correction',
    'rejected',
  ]),
  justification: z
    .string()
    .min(10, 'Justification must be at least 10 characters'),
  reasonCode: z.string().nullish(),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverrideStatusResult =
  | { success: true }
  | { success: false; error: string }

const CONDITIONAL_DEADLINE_DAYS = 7
const CORRECTION_DEADLINE_DAYS = 30

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function overrideStatus(
  input: z.infer<typeof overrideStatusSchema>,
): Promise<OverrideStatusResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  if (session.user.role === 'applicant') {
    return {
      success: false,
      error: 'Only specialists can override label status',
    }
  }

  const parsed = overrideStatusSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return {
      success: false,
      error: firstError.message,
    }
  }

  const { labelId, newStatus, justification, reasonCode } = parsed.data

  try {
    // Fetch current label
    const [label] = await db
      .select()
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1)

    if (!label) {
      return { success: false, error: 'Label not found' }
    }

    // Block overrides on labels still being processed
    if (label.status === 'pending' || label.status === 'processing') {
      return {
        success: false,
        error: 'Cannot override a label that is still being processed',
      }
    }

    // Block no-op overrides
    if (label.status === newStatus) {
      return {
        success: false,
        error: `Label is already "${newStatus.replace(/_/g, ' ')}"`,
      }
    }

    // Compute correction deadline for the new status
    let correctionDeadline: Date | null = null
    if (newStatus === 'conditionally_approved') {
      correctionDeadline = addDays(new Date(), CONDITIONAL_DEADLINE_DAYS)
    } else if (newStatus === 'needs_correction') {
      correctionDeadline = addDays(new Date(), CORRECTION_DEADLINE_DAYS)
    }

    // Insert audit trail
    await db.insert(statusOverrides).values({
      labelId,
      specialistId: session.user.id,
      previousStatus: label.status,
      newStatus,
      justification,
      reasonCode: reasonCode ?? null,
    })

    // Update label
    await db
      .update(labels)
      .set({
        status: newStatus,
        correctionDeadline,
        deadlineExpired: false,
      })
      .where(eq(labels.id, labelId))

    revalidatePath('/')
    revalidatePath(`/labels/${labelId}`)

    return { success: true }
  } catch (error) {
    console.error('[overrideStatus] Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}
