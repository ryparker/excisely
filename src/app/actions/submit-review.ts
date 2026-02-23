'use server'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import {
  humanReviews,
  labels,
  validationItems,
  validationResults,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { type BeverageType } from '@/config/beverage-types'
import {
  determineOverallStatus,
  addDays,
  type ValidationItemStatus,
} from '@/lib/labels/validation-helpers'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const fieldOverrideSchema = z.object({
  validationItemId: z.string().min(1),
  originalStatus: z.enum([
    'match',
    'mismatch',
    'not_found',
    'needs_correction',
  ]),
  resolvedStatus: z.enum(['match', 'mismatch', 'not_found']),
  reviewerNotes: z.string().optional(),
  annotationData: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
})

const submitReviewSchema = z.object({
  labelId: z.string().min(1),
  overrides: z.array(fieldOverrideSchema).min(1),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubmitReviewResult = { success: true } | { success: false; error: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function submitReview(
  formData: FormData,
): Promise<SubmitReviewResult> {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  try {
    // 2. Parse form data
    const rawOverrides = formData.get('overrides')
    if (!rawOverrides || typeof rawOverrides !== 'string') {
      return { success: false, error: 'No review overrides provided' }
    }

    let parsedOverrides: unknown
    try {
      parsedOverrides = JSON.parse(rawOverrides)
    } catch {
      return { success: false, error: 'Invalid overrides format' }
    }

    const labelIdRaw = formData.get('labelId')
    if (!labelIdRaw || typeof labelIdRaw !== 'string') {
      return { success: false, error: 'Missing label ID' }
    }

    const rawData = {
      labelId: labelIdRaw,
      overrides: parsedOverrides,
    }

    const parsed = submitReviewSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return {
        success: false,
        error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
      }
    }

    const { labelId, overrides } = parsed.data

    // 3. Verify label exists and is in a reviewable state
    const [label] = await db
      .select()
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1)

    if (!label) {
      return { success: false, error: 'Label not found' }
    }

    const reviewableStatuses = [
      'pending_review',
      'needs_correction',
      'conditionally_approved',
      'processing',
    ]
    if (!reviewableStatuses.includes(label.status)) {
      return {
        success: false,
        error: `Label status "${label.status}" is not eligible for review`,
      }
    }

    // 4. Apply each override: create human review + update validation item
    for (const override of overrides) {
      await db.insert(humanReviews).values({
        specialistId: session.user.id,
        labelId,
        validationItemId: override.validationItemId,
        originalStatus: override.originalStatus,
        resolvedStatus: override.resolvedStatus,
        reviewerNotes: override.reviewerNotes || null,
        annotationData: override.annotationData ?? null,
      })

      await db
        .update(validationItems)
        .set({ status: override.resolvedStatus })
        .where(eq(validationItems.id, override.validationItemId))
    }

    // 5. Fetch all current validation items to determine new overall status
    const [currentResult] = await db
      .select()
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, labelId),
          eq(validationResults.isCurrent, true),
        ),
      )
      .limit(1)

    if (!currentResult) {
      return { success: false, error: 'No validation result found for label' }
    }

    const finalItems = await db
      .select({
        fieldName: validationItems.fieldName,
        status: validationItems.status,
      })
      .from(validationItems)
      .where(eq(validationItems.validationResultId, currentResult.id))

    // 6. Determine new overall label status (no containerSizeMl — reviews don't re-validate size)
    const { status: newStatus, deadlineDays } = determineOverallStatus(
      finalItems as Array<{ fieldName: string; status: ValidationItemStatus }>,
      label.beverageType as BeverageType,
    )

    const correctionDeadline = deadlineDays
      ? addDays(new Date(), deadlineDays)
      : null

    // 7. Update label status
    await db
      .update(labels)
      .set({
        status: newStatus,
        correctionDeadline,
      })
      .where(eq(labels.id, labelId))

    return { success: true }
  } catch (error) {
    console.error('[submitReview] Unexpected error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during review submission',
    }
  }
}
