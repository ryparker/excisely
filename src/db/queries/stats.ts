import { sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { humanReviews, validationItems } from '@/db/schema'

// ---------------------------------------------------------------------------
// Field Match Rates
// ---------------------------------------------------------------------------

/** Per-field match rates (percentage of items that are a 'match'). */
export async function getFieldMatchRates(): Promise<Record<string, number>> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const rows = await db
    .select({
      fieldName: validationItems.fieldName,
      matchRate: sql<number>`round(
        count(CASE WHEN ${validationItems.status} = 'match' THEN 1 END)::numeric
        / NULLIF(count(*), 0)::numeric * 100
      )::int`,
    })
    .from(validationItems)
    .groupBy(validationItems.fieldName)

  const rates: Record<string, number> = {}
  for (const row of rows) {
    rates[row.fieldName] = row.matchRate
  }
  return rates
}

// ---------------------------------------------------------------------------
// Field Override Rates
// ---------------------------------------------------------------------------

/** Per-field override rates (percentage of flagged items overridden to 'match' by specialists). */
export async function getFieldOverrideRates(): Promise<Record<string, number>> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const rows = await db
    .select({
      fieldName: validationItems.fieldName,
      flaggedTotal: sql<number>`count(*)::int`,
      overriddenCount: sql<number>`count(
        CASE WHEN ${humanReviews.resolvedStatus} = 'match' THEN 1 END
      )::int`,
    })
    .from(validationItems)
    .leftJoin(
      humanReviews,
      sql`${humanReviews.validationItemId} = ${validationItems.id}`,
    )
    .where(sql`${validationItems.status} != 'match'`)
    .groupBy(validationItems.fieldName)

  const rates: Record<string, number> = {}
  for (const row of rows) {
    if (row.flaggedTotal > 0) {
      rates[row.fieldName] = Math.round(
        (row.overriddenCount / row.flaggedTotal) * 100,
      )
    }
  }
  return rates
}

// ---------------------------------------------------------------------------
// Inferred Return Types
// ---------------------------------------------------------------------------

export type FieldMatchRatesResult = Awaited<
  ReturnType<typeof getFieldMatchRates>
>
export type FieldOverrideRatesResult = Awaited<
  ReturnType<typeof getFieldOverrideRates>
>
