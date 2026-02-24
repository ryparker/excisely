import { and, desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import {
  humanReviews,
  statusOverrides,
  users,
  validationItems,
  validationResults,
} from '@/db/schema'

// ---------------------------------------------------------------------------
// Current Validation Result
// ---------------------------------------------------------------------------

/** Latest non-superseded validation result for a label. */
export async function getCurrentValidationResult(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [result] = await db
    .select()
    .from(validationResults)
    .where(
      and(
        eq(validationResults.labelId, labelId),
        eq(validationResults.isCurrent, true),
      ),
    )
    .limit(1)

  return result ?? null
}

// ---------------------------------------------------------------------------
// Validation Items
// ---------------------------------------------------------------------------

/** Validation items for a specific validation result ID. */
export async function getValidationItems(resultId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select()
    .from(validationItems)
    .where(eq(validationItems.validationResultId, resultId))
}

/** Validation items via result join (when you have labelId but not resultId). */
export async function getValidationItemsForLabel(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select({ id: validationItems.id })
    .from(validationItems)
    .innerJoin(
      validationResults,
      eq(validationItems.validationResultId, validationResults.id),
    )
    .where(eq(validationResults.labelId, labelId))
}

// ---------------------------------------------------------------------------
// Human Reviews
// ---------------------------------------------------------------------------

/** Human reviews for a label, ordered by review date. */
export async function getHumanReviews(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select({
      id: humanReviews.id,
      fieldName: validationItems.fieldName,
      originalStatus: humanReviews.originalStatus,
      resolvedStatus: humanReviews.resolvedStatus,
      reviewerNotes: humanReviews.reviewerNotes,
      reviewedAt: humanReviews.reviewedAt,
      specialistName: users.name,
    })
    .from(humanReviews)
    .innerJoin(users, eq(humanReviews.specialistId, users.id))
    .leftJoin(
      validationItems,
      eq(humanReviews.validationItemId, validationItems.id),
    )
    .where(eq(humanReviews.labelId, labelId))
    .orderBy(humanReviews.reviewedAt)
}

// ---------------------------------------------------------------------------
// Status Overrides
// ---------------------------------------------------------------------------

/** Status overrides for a label, ordered by creation date descending. */
export async function getStatusOverrides(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select({
      id: statusOverrides.id,
      previousStatus: statusOverrides.previousStatus,
      newStatus: statusOverrides.newStatus,
      justification: statusOverrides.justification,
      reasonCode: statusOverrides.reasonCode,
      createdAt: statusOverrides.createdAt,
      specialistName: users.name,
    })
    .from(statusOverrides)
    .innerJoin(users, eq(statusOverrides.specialistId, users.id))
    .where(eq(statusOverrides.labelId, labelId))
    .orderBy(desc(statusOverrides.createdAt))
}

// ---------------------------------------------------------------------------
// Superseded Results
// ---------------------------------------------------------------------------

/** Superseded (previous) validation results for a label. */
export async function getSupersededResults(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select({
      id: validationResults.id,
      createdAt: validationResults.createdAt,
      modelUsed: validationResults.modelUsed,
      processingTimeMs: validationResults.processingTimeMs,
      totalTokens: validationResults.totalTokens,
    })
    .from(validationResults)
    .where(
      and(
        eq(validationResults.labelId, labelId),
        eq(validationResults.isCurrent, false),
      ),
    )
    .orderBy(desc(validationResults.createdAt))
}

// ---------------------------------------------------------------------------
// Inferred Return Types
// ---------------------------------------------------------------------------

export type CurrentValidationResult = Awaited<
  ReturnType<typeof getCurrentValidationResult>
>
export type ValidationItemsResult = Awaited<
  ReturnType<typeof getValidationItems>
>
export type ValidationItemsForLabelResult = Awaited<
  ReturnType<typeof getValidationItemsForLabel>
>
export type HumanReviewsResult = Awaited<ReturnType<typeof getHumanReviews>>
export type StatusOverridesResult = Awaited<
  ReturnType<typeof getStatusOverrides>
>
export type SupersededResultsResult = Awaited<
  ReturnType<typeof getSupersededResults>
>
