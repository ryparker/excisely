'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { routes } from '@/config/routes'
import { db } from '@/db'
import { labels, statusOverrides } from '@/db/schema'
import {
  CONDITIONAL_DEADLINE_DAYS,
  CORRECTION_DEADLINE_DAYS,
} from '@/config/constants'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { addDays } from '@/lib/labels/validation-helpers'

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

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function overrideStatus(
  input: z.infer<typeof overrideStatusSchema>,
): Promise<OverrideStatusResult> {
  const guard = await guardSpecialist()
  if (!guard.success) return guard
  const { session } = guard

  const parsed = overrideStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
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

    revalidatePath(routes.home())
    revalidatePath(routes.label(labelId))

    return { success: true }
  } catch (error) {
    console.error('[overrideStatus] Unexpected error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred',
    }
  }
}
