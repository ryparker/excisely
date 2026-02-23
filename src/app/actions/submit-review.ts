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
import { getMandatoryFields, type BeverageType } from '@/config/beverage-types'

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

type LabelStatus =
  | 'approved'
  | 'conditionally_approved'
  | 'needs_correction'
  | 'rejected'

/**
 * Fields where a mismatch is considered minor — the label can still
 * receive "conditionally approved" status with a 7-day correction window.
 */
const MINOR_DISCREPANCY_FIELDS = new Set([
  'brand_name',
  'fanciful_name',
  'appellation_of_origin',
  'grape_varietal',
])

/**
 * Fields where a missing or mismatched value triggers immediate rejection.
 */
const REJECTION_FIELDS = new Set(['health_warning'])

const CONDITIONAL_DEADLINE_DAYS = 7
const CORRECTION_DEADLINE_DAYS = 30

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Determines the overall label status based on the final resolved statuses
 * of all validation items after human review.
 */
function determineOverallStatusFromItems(
  items: Array<{ fieldName: string; status: string }>,
  beverageType: BeverageType,
): { status: LabelStatus; deadlineDays: number | null } {
  const mandatory = new Set(getMandatoryFields(beverageType))

  let hasRejection = false
  let hasSubstantiveMismatch = false
  let hasMinorDiscrepancy = false

  for (const item of items) {
    const isMandatory = mandatory.has(item.fieldName)
    const isRejectionField = REJECTION_FIELDS.has(item.fieldName)
    const isMinorField = MINOR_DISCREPANCY_FIELDS.has(item.fieldName)

    if (item.status === 'match') {
      continue
    }

    if (item.status === 'not_found' && isMandatory) {
      if (isRejectionField) {
        hasRejection = true
      } else {
        hasSubstantiveMismatch = true
      }
      continue
    }

    if (item.status === 'mismatch' || item.status === 'needs_correction') {
      if (isRejectionField) {
        hasRejection = true
      } else if (isMinorField) {
        hasMinorDiscrepancy = true
      } else if (isMandatory) {
        hasSubstantiveMismatch = true
      } else {
        hasMinorDiscrepancy = true
      }
    }
  }

  if (hasRejection) {
    return { status: 'rejected', deadlineDays: null }
  }

  if (hasSubstantiveMismatch) {
    return {
      status: 'needs_correction',
      deadlineDays: CORRECTION_DEADLINE_DAYS,
    }
  }

  if (hasMinorDiscrepancy) {
    return {
      status: 'conditionally_approved',
      deadlineDays: CONDITIONAL_DEADLINE_DAYS,
    }
  }

  return { status: 'approved', deadlineDays: null }
}

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

    const rawData = {
      labelId: formData.get('labelId') as string,
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

    // 6. Determine new overall label status
    const { status: newStatus, deadlineDays } = determineOverallStatusFromItems(
      finalItems,
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
