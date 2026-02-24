import { and, asc, count, desc, eq, ilike, sql, type SQL } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { humanReviews, users, validationItems } from '@/db/schema'

// ---------------------------------------------------------------------------
// AI Error Stats
// ---------------------------------------------------------------------------

export interface AIErrorStats {
  totalErrors: number
  missedErrors: number
  overFlagged: number
}

/** Aggregated AI error counts: total, missed (AI said match, specialist disagreed), over-flagged. */
export async function getAIErrorStats(): Promise<AIErrorStats> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [result] = await db
    .select({
      totalErrors: count(),
      missedErrors: sql<number>`count(case when ${humanReviews.originalStatus} = 'match' and ${humanReviews.resolvedStatus} != 'match' then 1 end)`,
      overFlagged: sql<number>`count(case when ${humanReviews.originalStatus} != 'match' and ${humanReviews.resolvedStatus} = 'match' then 1 end)`,
    })
    .from(humanReviews)
    .where(
      sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`,
    )

  return {
    totalErrors: result?.totalErrors ?? 0,
    missedErrors: result?.missedErrors ?? 0,
    overFlagged: result?.overFlagged ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Filtered AI Errors (paginated table)
// ---------------------------------------------------------------------------

export interface FilteredAIErrorsOptions {
  /** Search by brand name. */
  searchTerm?: string
  /** Filter by validation item field name. */
  fieldFilter?: string
  /** Error type filter: 'missed' or 'over_flagged'. */
  typeFilter?: string
  /** Column to sort by. */
  sortKey?: string
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc'
  /** 1-based page number. */
  currentPage?: number
  /** Rows per page. */
  pageSize?: number
  /** Valid field names for the fieldFilter (prevents injection). */
  validFieldNames?: string[]
}

/** Paginated, filterable, sortable AI errors list with brand name subquery. */
export async function getFilteredAIErrors(opts: FilteredAIErrorsOptions = {}) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const {
    searchTerm,
    fieldFilter,
    typeFilter,
    sortKey,
    sortOrder = 'desc',
    currentPage = 1,
    pageSize = 20,
    validFieldNames = [],
  } = opts

  const statusMismatch = sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`
  const conditions: SQL[] = [statusMismatch]

  if (fieldFilter && validFieldNames.includes(fieldFilter)) {
    conditions.push(
      eq(
        validationItems.fieldName,
        fieldFilter as (typeof validationItems.fieldName.enumValues)[number],
      ),
    )
  }

  if (typeFilter === 'missed') {
    conditions.push(eq(humanReviews.originalStatus, 'match'))
  } else if (typeFilter === 'over_flagged') {
    conditions.push(sql`${humanReviews.originalStatus}::text != 'match'`)
    conditions.push(eq(humanReviews.resolvedStatus, 'match'))
  }

  if (searchTerm) {
    conditions.push(
      ilike(
        sql`(
          SELECT ad.brand_name FROM application_data ad
          WHERE ad.label_id = ${humanReviews.labelId}
          LIMIT 1
        )`,
        `%${searchTerm}%`,
      ),
    )
  }

  const offset = (currentPage - 1) * pageSize

  // Brand name subquery for sorting
  const brandNameSql = sql`(
    SELECT ad.brand_name FROM application_data ad
    WHERE ad.label_id = ${humanReviews.labelId}
    LIMIT 1
  )`

  // Sort column mapping
  const SORT_COLUMNS: Record<
    string,
    | ReturnType<typeof sql>
    | typeof humanReviews.reviewedAt
    | typeof validationItems.fieldName
    | typeof validationItems.confidence
  > = {
    reviewedAt: humanReviews.reviewedAt,
    fieldName: validationItems.fieldName,
    confidence: validationItems.confidence,
    brandName: brandNameSql,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = [sortOrder === 'asc' ? asc(col) : desc(col)]
  } else {
    orderByClause = [desc(humanReviews.reviewedAt)]
  }

  const [totalQuery, rows] = await Promise.all([
    db
      .select({ count: count() })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .where(and(...conditions)),
    db
      .select({
        id: humanReviews.id,
        reviewedAt: humanReviews.reviewedAt,
        originalStatus: humanReviews.originalStatus,
        resolvedStatus: humanReviews.resolvedStatus,
        reviewerNotes: humanReviews.reviewerNotes,
        fieldName: validationItems.fieldName,
        confidence: validationItems.confidence,
        labelId: humanReviews.labelId,
        brandName: sql<string>`(
          SELECT ad.brand_name FROM application_data ad
          WHERE ad.label_id = ${humanReviews.labelId}
          LIMIT 1
        )`,
        specialistName: users.name,
      })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .innerJoin(users, eq(humanReviews.specialistId, users.id))
      .where(and(...conditions))
      .orderBy(...orderByClause)
      .limit(pageSize)
      .offset(offset),
  ])

  const totalCount = totalQuery[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return { rows, totalCount, totalPages }
}

// ---------------------------------------------------------------------------
// Inferred Return Types
// ---------------------------------------------------------------------------

export type AIErrorStatsResult = Awaited<ReturnType<typeof getAIErrorStats>>
export type FilteredAIErrorsResult = Awaited<
  ReturnType<typeof getFilteredAIErrors>
>
