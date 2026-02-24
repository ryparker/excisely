'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'

import { getLabelById } from '@/db/queries/labels'
import { updateLabelStatus } from '@/db/mutations/labels'
import { insertStatusOverride } from '@/db/mutations/reviews'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { formatZodError } from '@/lib/actions/parse-zod-error'
import { logActionError } from '@/lib/actions/action-error'
import { computeCorrectionDeadline } from '@/lib/labels/compute-deadline'
import type { ActionResult } from '@/lib/actions/result-types'
import { humanizeEnum } from '@/lib/utils'

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
// Server Action
// ---------------------------------------------------------------------------

export async function overrideStatus(
  input: z.infer<typeof overrideStatusSchema>,
): Promise<ActionResult> {
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
    const label = await getLabelById(labelId)

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
        error: `Label is already "${humanizeEnum(newStatus)}"`,
      }
    }

    const correctionDeadline = computeCorrectionDeadline(newStatus)

    // Insert audit trail
    await insertStatusOverride({
      labelId,
      specialistId: session.user.id,
      previousStatus: label.status,
      newStatus,
      justification,
      reasonCode: reasonCode ?? null,
    })

    // Update label
    await updateLabelStatus(labelId, {
      status: newStatus,
      correctionDeadline,
      deadlineExpired: false,
    })

    updateTag('labels')
    updateTag('sla-metrics')
    // PRODUCTION: after(() => { notifyApplicant(labelId); trackAnalytics('status_overridden') })

    return { success: true }
  } catch (error) {
    return logActionError('overrideStatus', error)
  }
}
