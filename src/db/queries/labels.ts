import {
  eq,
  and,
  desc,
  asc,
  count,
  ilike,
  or,
  gt,
  sql,
  type SQL,
} from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { labels, applicationData, applicants, labelImages } from '@/db/schema'
import { getApprovalThreshold } from '@/db/queries/settings'

// ---------------------------------------------------------------------------
// Private Helpers (subqueries)
// ---------------------------------------------------------------------------

/**
 * Subquery: count of non-match validation items for the current result.
 * Returns the number of items with status 'needs_correction', 'mismatch', or 'not_found'.
 */
function flaggedCountSubquery() {
  return sql<number>`(
    SELECT count(*)::int FROM validation_items vi
    INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
    WHERE vr.label_id = ${labels.id}
    AND vr.is_current = true
    AND vi.status IN ('needs_correction', 'mismatch', 'not_found')
  )`
}

/**
 * Subquery: URL of the first image, preferring front-type images.
 * Falls back to the lowest sort_order image if no front image exists.
 */
function thumbnailUrlSubquery() {
  return sql<string | null>`(
    SELECT li.image_url FROM label_images li
    WHERE li.label_id = ${labels.id}
    ORDER BY
      CASE WHEN li.image_type = 'front' THEN 0 ELSE 1 END,
      li.sort_order
    LIMIT 1
  )`
}

/**
 * SQL conditions that define a "ready to approve" label:
 * pending_review + AI proposed approved + high confidence + all items match.
 */
function readyToApproveConditions(approvalThreshold: number): SQL[] {
  return [
    eq(labels.status, 'pending_review'),
    eq(labels.aiProposedStatus, 'approved'),
    sql`${labels.overallConfidence}::numeric >= ${approvalThreshold}`,
    sql`NOT EXISTS (
      SELECT 1 FROM validation_items vi
      INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
      WHERE vr.label_id = ${labels.id}
      AND vr.is_current = true
      AND vi.status != 'match'
    )`,
  ]
}

// ---------------------------------------------------------------------------
// Pending Review Count (sidebar badge)
// ---------------------------------------------------------------------------

/** Count of labels in review-related statuses (pending_review, needs_correction, conditionally_approved). */
export async function getPendingReviewCount(): Promise<number> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(labels)
    .where(
      sql`${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved')`,
    )

  return result?.total ?? 0
}

// ---------------------------------------------------------------------------
// Applicant Label Count
// ---------------------------------------------------------------------------

/** Total label count for a specific applicant. */
export async function getApplicantLabelCount(
  applicantId: string,
): Promise<number> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [result] = await db
    .select({ total: count() })
    .from(labels)
    .where(eq(labels.applicantId, applicantId))

  return result?.total ?? 0
}

// ---------------------------------------------------------------------------
// Label by ID and Applicant (ownership-checked fetch)
// ---------------------------------------------------------------------------

/** Fetch a single label where both id and applicantId match (ownership check). */
export async function getLabelByIdAndApplicant(
  id: string,
  applicantId: string,
) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [label] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, id), eq(labels.applicantId, applicantId)))
    .limit(1)

  return label ?? null
}

// ---------------------------------------------------------------------------
// Status Counts
// ---------------------------------------------------------------------------

/** Label status counts, optionally filtered by applicant. */
export async function getStatusCounts(applicantId?: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const whereClause = applicantId
    ? eq(labels.applicantId, applicantId)
    : undefined

  return db
    .select({ status: labels.status, count: count() })
    .from(labels)
    .where(whereClause)
    .groupBy(labels.status)
}

// ---------------------------------------------------------------------------
// Ready to Approve Count
// ---------------------------------------------------------------------------

/** Count of labels ready for bulk approval. */
export async function getReadyToApproveCount() {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const approvalThreshold = await getApprovalThreshold()

  const [result] = await db
    .select({ total: count() })
    .from(labels)
    .where(and(...readyToApproveConditions(approvalThreshold)))

  return result?.total ?? 0
}

// ---------------------------------------------------------------------------
// Filtered Labels (paginated list for both specialist and applicant views)
// ---------------------------------------------------------------------------

export interface FilteredLabelsOptions {
  /** Filter to a specific applicant's labels (applicant view). */
  applicantId?: string
  /** Search by brand name (specialist) or brand/fanciful/serial/class (applicant). */
  searchTerm?: string
  /** Filter by label status. Special values: 'in_review', 'needs_attention'. */
  statusFilter?: string
  /** Queue filter: 'ready' or 'review' (specialist only). */
  queueFilter?: string
  /** Filter by beverage type. */
  beverageTypeFilter?: string
  /** Column to sort by. */
  sortKey?: string
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc'
  /** 1-based page number. */
  currentPage?: number
  /** Rows per page. */
  pageSize?: number
}

/** Paginated, filterable, sortable labels list for specialist dashboard and applicant submissions. */
export async function getFilteredLabels(opts: FilteredLabelsOptions = {}) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const {
    applicantId,
    searchTerm,
    statusFilter,
    queueFilter,
    beverageTypeFilter,
    sortKey,
    sortOrder = 'desc',
    currentPage = 1,
    pageSize = 20,
  } = opts

  const offset = (currentPage - 1) * pageSize
  const isApplicantView = !!applicantId

  // Build where conditions
  const conditions: SQL[] = []

  if (applicantId) {
    conditions.push(eq(labels.applicantId, applicantId))
  }

  // Search: applicant view searches more fields than specialist view
  if (searchTerm) {
    if (isApplicantView) {
      conditions.push(
        or(
          ilike(applicationData.brandName, `%${searchTerm}%`),
          ilike(applicationData.fancifulName, `%${searchTerm}%`),
          ilike(applicationData.serialNumber, `%${searchTerm}%`),
          ilike(applicationData.classType, `%${searchTerm}%`),
        )!,
      )
    } else {
      conditions.push(ilike(applicationData.brandName, `%${searchTerm}%`))
    }
  }

  // Status filter: applicant view has grouped statuses
  if (statusFilter) {
    if (isApplicantView && statusFilter === 'in_review') {
      conditions.push(
        or(
          eq(labels.status, 'pending'),
          eq(labels.status, 'processing'),
          eq(labels.status, 'pending_review'),
        )!,
      )
    } else if (isApplicantView && statusFilter === 'needs_attention') {
      conditions.push(
        or(
          eq(labels.status, 'needs_correction'),
          eq(labels.status, 'conditionally_approved'),
        )!,
      )
    } else {
      conditions.push(
        eq(
          labels.status,
          statusFilter as (typeof labels.status.enumValues)[number],
        ),
      )
    }
  }

  if (beverageTypeFilter) {
    conditions.push(
      eq(
        labels.beverageType,
        beverageTypeFilter as (typeof labels.beverageType.enumValues)[number],
      ),
    )
  }

  // Queue filter (specialist only): ready = bulk-approvable, review = needs manual attention
  let approvalThreshold: number | undefined
  if (queueFilter === 'ready' || queueFilter === 'review') {
    approvalThreshold = await getApprovalThreshold()
  }

  if (queueFilter === 'ready' && approvalThreshold !== undefined) {
    conditions.push(...readyToApproveConditions(approvalThreshold))
  } else if (queueFilter === 'review' && approvalThreshold !== undefined) {
    conditions.push(eq(labels.status, 'pending_review'))
    conditions.push(sql`(
      ${labels.aiProposedStatus} IS DISTINCT FROM 'approved'
      OR ${labels.overallConfidence}::numeric < ${approvalThreshold}
      OR EXISTS (
        SELECT 1 FROM validation_items vi
        INNER JOIN validation_results vr ON vi.validation_result_id = vr.id
        WHERE vr.label_id = ${labels.id}
        AND vr.is_current = true
        AND vi.status != 'match'
      )
    )`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Flagged count subquery (reused in select and sort)
  const flaggedCountSql = flaggedCountSubquery()

  // Determine sort order
  const SORT_COLUMNS: Record<
    string,
    | ReturnType<typeof sql>
    | typeof labels.createdAt
    | typeof applicationData.brandName
    | typeof labels.beverageType
    | typeof labels.overallConfidence
    | typeof labels.status
  > = {
    brandName: applicationData.brandName,
    beverageType: labels.beverageType,
    flaggedCount: flaggedCountSql,
    overallConfidence: labels.overallConfidence,
    createdAt: labels.createdAt,
    status: labels.status,
  }

  let orderByClause
  if (sortKey === 'flaggedCount') {
    orderByClause = [
      sortOrder === 'asc' ? asc(flaggedCountSql) : desc(flaggedCountSql),
    ]
  } else if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = [sortOrder === 'asc' ? asc(col) : desc(col)]
  } else if (queueFilter === 'ready') {
    orderByClause = [desc(labels.overallConfidence)]
  } else if (!isApplicantView) {
    orderByClause = [desc(labels.isPriority), desc(labels.createdAt)]
  } else {
    orderByClause = [desc(labels.createdAt)]
  }

  // Build select columns — specialist view includes more fields
  const baseSelect = {
    id: labels.id,
    status: labels.status,
    beverageType: labels.beverageType,
    correctionDeadline: labels.correctionDeadline,
    deadlineExpired: labels.deadlineExpired,
    updatedAt: labels.updatedAt,
    createdAt: labels.createdAt,
    brandName: applicationData.brandName,
    flaggedCount: flaggedCountSql,
    thumbnailUrl: thumbnailUrlSubquery(),
  }

  const specialistSelect = {
    ...baseSelect,
    overallConfidence: labels.overallConfidence,
    isPriority: labels.isPriority,
    overrideReasonCode: sql<string | null>`(
      SELECT so.reason_code FROM status_overrides so
      WHERE so.label_id = ${labels.id}
      ORDER BY so.created_at DESC
      LIMIT 1
    )`,
  }

  const applicantSelect = {
    ...baseSelect,
    fancifulName: applicationData.fancifulName,
    serialNumber: applicationData.serialNumber,
  }

  const selectColumns = isApplicantView ? applicantSelect : specialistSelect

  const [tableCountResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(whereClause),
    db
      .select(selectColumns)
      .from(labels)
      .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(pageSize)
      .offset(offset),
  ])

  const tableTotal = tableCountResult[0]?.total ?? 0
  const totalPages = Math.ceil(tableTotal / pageSize)

  return { rows, tableTotal, totalPages }
}

// ---------------------------------------------------------------------------
// Applicant Detail Labels (for applicant detail page)
// ---------------------------------------------------------------------------

export interface ApplicantDetailLabelsOptions {
  beverageTypeFilter?: string
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
}

/** Labels for an applicant detail page, with optional beverage type filter and sort. */
export async function getApplicantDetailLabels(
  applicantId: string,
  opts: ApplicantDetailLabelsOptions = {},
) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const { beverageTypeFilter, sortKey, sortOrder = 'desc' } = opts

  const conditions: SQL[] = [eq(labels.applicantId, applicantId)]

  if (beverageTypeFilter) {
    conditions.push(
      eq(
        labels.beverageType,
        beverageTypeFilter as (typeof labels.beverageType.enumValues)[number],
      ),
    )
  }

  const SORT_COLUMNS: Record<
    string,
    | typeof labels.createdAt
    | typeof applicationData.brandName
    | typeof labels.beverageType
    | typeof labels.overallConfidence
  > = {
    brandName: applicationData.brandName,
    beverageType: labels.beverageType,
    overallConfidence: labels.overallConfidence,
    createdAt: labels.createdAt,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = desc(labels.createdAt)
  }

  return db
    .select({
      id: labels.id,
      status: labels.status,
      beverageType: labels.beverageType,
      overallConfidence: labels.overallConfidence,
      correctionDeadline: labels.correctionDeadline,
      deadlineExpired: labels.deadlineExpired,
      updatedAt: labels.updatedAt,
      createdAt: labels.createdAt,
      brandName: applicationData.brandName,
    })
    .from(labels)
    .leftJoin(applicationData, eq(labels.id, applicationData.labelId))
    .where(and(...conditions))
    .orderBy(orderByClause)
}

// ---------------------------------------------------------------------------
// Single Label by ID
// ---------------------------------------------------------------------------

/** Fetch a single label by ID. */
export async function getLabelById(id: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [label] = await db
    .select()
    .from(labels)
    .where(eq(labels.id, id))
    .limit(1)

  return label ?? null
}

// ---------------------------------------------------------------------------
// Label Application Data
// ---------------------------------------------------------------------------

/** Application data (Form 5100.31 fields) for a label. */
export async function getLabelAppData(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [appData] = await db
    .select()
    .from(applicationData)
    .where(eq(applicationData.labelId, labelId))
    .limit(1)

  return appData ?? null
}

// ---------------------------------------------------------------------------
// Label Images
// ---------------------------------------------------------------------------

/** Images for a label, ordered by sort order. */
export async function getLabelImages(labelId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  return db
    .select()
    .from(labelImages)
    .where(eq(labelImages.labelId, labelId))
    .orderBy(labelImages.sortOrder)
}

// ---------------------------------------------------------------------------
// Brand Name (for generateMetadata)
// ---------------------------------------------------------------------------

/** Brand name from application data for a label (used in generateMetadata). */
export async function getBrandNameForLabel(
  labelId: string,
): Promise<string | null> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [row] = await db
    .select({ brandName: applicationData.brandName })
    .from(applicationData)
    .where(eq(applicationData.labelId, labelId))
    .limit(1)

  return row?.brandName ?? null
}

// ---------------------------------------------------------------------------
// Nearest Deadline
// ---------------------------------------------------------------------------

/** Nearest correction deadline for an applicant's labels. */
export async function getNearestDeadline(
  applicantId: string,
): Promise<Date | null> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [result] = await db
    .select({ deadline: labels.correctionDeadline })
    .from(labels)
    .where(
      and(
        eq(labels.applicantId, applicantId),
        gt(labels.correctionDeadline, new Date()),
        eq(labels.deadlineExpired, false),
      ),
    )
    .orderBy(asc(labels.correctionDeadline))
    .limit(1)

  return result?.deadline ?? null
}

// ---------------------------------------------------------------------------
// Label Applicant (for detail page header)
// ---------------------------------------------------------------------------

/** Fetch the applicant record for a label (by label's applicantId). */
export async function getLabelApplicant(applicantId: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [applicant] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, applicantId))
    .limit(1)

  return applicant ?? null
}

// ---------------------------------------------------------------------------
// Inferred Return Types
// ---------------------------------------------------------------------------

export type StatusCountsResult = Awaited<ReturnType<typeof getStatusCounts>>
export type FilteredLabelsResult = Awaited<ReturnType<typeof getFilteredLabels>>
export type LabelByIdResult = Awaited<ReturnType<typeof getLabelById>>
export type LabelAppDataResult = Awaited<ReturnType<typeof getLabelAppData>>
export type LabelImagesResult = Awaited<ReturnType<typeof getLabelImages>>
export type NearestDeadlineResult = Awaited<
  ReturnType<typeof getNearestDeadline>
>
export type LabelByIdAndApplicantResult = Awaited<
  ReturnType<typeof getLabelByIdAndApplicant>
>
