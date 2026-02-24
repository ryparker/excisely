import { eq, sql, desc, asc, count } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { applicants, labels, statusOverrides } from '@/db/schema'

// ---------------------------------------------------------------------------
// Single Applicant
// ---------------------------------------------------------------------------

/** Fetch a single applicant by ID. */
export async function getApplicantById(id: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [applicant] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.id, id))
    .limit(1)

  return applicant ?? null
}

/** Company name for generateMetadata. */
export async function getApplicantCompanyName(
  id: string,
): Promise<string | null> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [row] = await db
    .select({ companyName: applicants.companyName })
    .from(applicants)
    .where(eq(applicants.id, id))
    .limit(1)

  return row?.companyName ?? null
}

// ---------------------------------------------------------------------------
// Applicant by Email (NO CACHE — used in mutation flow)
// ---------------------------------------------------------------------------

/** Find applicant by contact email. No cache — used in submit-application. */
export async function getApplicantByEmail(email: string) {
  const [applicant] = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(eq(applicants.contactEmail, email))
    .limit(1)

  return applicant ?? null
}

// ---------------------------------------------------------------------------
// Full Applicant by Email (cached — used in page components)
// ---------------------------------------------------------------------------

/** Full applicant record by contact email. Cached for page-level use. */
export async function getFullApplicantByEmail(email: string) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [applicant] = await db
    .select()
    .from(applicants)
    .where(eq(applicants.contactEmail, email))
    .limit(1)

  return applicant ?? null
}

// ---------------------------------------------------------------------------
// Applicants with Stats (paginated list)
// ---------------------------------------------------------------------------

export interface ApplicantsWithStatsOptions {
  searchTerm?: string
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
}

/** Paginated applicants with aggregated label stats (approval rate, total labels, etc.). */
export async function getApplicantsWithStats(
  opts: ApplicantsWithStatsOptions = {},
) {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const { searchTerm, sortKey, sortOrder = 'desc' } = opts

  // Computed columns for sorting
  const reviewedCountSql = sql<number>`count(case when ${labels.status} in ('approved', 'needs_correction', 'conditionally_approved', 'rejected') then 1 end)`
  const approvalRateSql = sql<number>`
    CASE WHEN ${reviewedCountSql} > 0
    THEN round((count(case when ${labels.status} = 'approved' then 1 end)::numeric / ${reviewedCountSql}) * 100)
    ELSE 0 END
  `
  const totalLabelsSql = count(labels.id)
  const lastSubmissionSql = sql<Date | null>`max(${labels.createdAt})`

  // Map sort keys to columns
  const SORT_COLUMNS: Record<
    string,
    ReturnType<typeof sql> | typeof applicants.companyName
  > = {
    companyName: applicants.companyName,
    totalLabels: totalLabelsSql,
    approvalRate: approvalRateSql,
    lastSubmission: lastSubmissionSql,
  }

  let orderByClause
  if (sortKey && SORT_COLUMNS[sortKey]) {
    const col = SORT_COLUMNS[sortKey]
    orderByClause = sortOrder === 'asc' ? asc(col) : desc(col)
  } else {
    orderByClause = desc(applicants.createdAt)
  }

  return db
    .select({
      id: applicants.id,
      companyName: applicants.companyName,
      contactEmail: applicants.contactEmail,
      createdAt: applicants.createdAt,
      totalLabels: totalLabelsSql,
      approvedCount: sql<number>`count(case when ${labels.status} = 'approved' then 1 end)`,
      reviewedCount: sql<number>`count(case when ${labels.status} in ('approved', 'needs_correction', 'conditionally_approved', 'rejected') then 1 end)`,
      lastSubmission: lastSubmissionSql,
      topOverrideReason: sql<string | null>`(
        SELECT so.reason_code FROM status_overrides so
        INNER JOIN labels l ON so.label_id = l.id
        WHERE l.applicant_id = ${applicants.id}
        AND so.reason_code IS NOT NULL
        AND so.new_status IN ('rejected', 'needs_correction')
        GROUP BY so.reason_code
        ORDER BY count(*) DESC
        LIMIT 1
      )`,
    })
    .from(applicants)
    .leftJoin(labels, eq(applicants.id, labels.applicantId))
    .where(
      searchTerm
        ? sql`lower(${applicants.companyName}) like ${`%${searchTerm.toLowerCase()}%`}`
        : undefined,
    )
    .groupBy(applicants.id)
    .orderBy(orderByClause)
}

// ---------------------------------------------------------------------------
// Top Override Reason
// ---------------------------------------------------------------------------

/** Most common override reason for a specific applicant. */
export async function getTopOverrideReason(
  applicantId: string,
): Promise<string | null> {
  'use cache'
  cacheTag('labels')
  cacheLife('seconds')

  const [row] = await db
    .select({
      reasonCode: statusOverrides.reasonCode,
      count: sql<number>`count(*)`,
    })
    .from(statusOverrides)
    .innerJoin(labels, eq(statusOverrides.labelId, labels.id))
    .where(
      sql`${labels.applicantId} = ${applicantId}
        AND ${statusOverrides.reasonCode} IS NOT NULL
        AND ${statusOverrides.newStatus} IN ('rejected', 'needs_correction')`,
    )
    .groupBy(statusOverrides.reasonCode)
    .orderBy(sql`count(*) desc`)
    .limit(1)

  return row?.reasonCode ?? null
}

// ---------------------------------------------------------------------------
// Inferred Return Types
// ---------------------------------------------------------------------------

export type ApplicantByIdResult = Awaited<ReturnType<typeof getApplicantById>>
export type ApplicantsWithStatsResult = Awaited<
  ReturnType<typeof getApplicantsWithStats>
>
export type TopOverrideReasonResult = Awaited<
  ReturnType<typeof getTopOverrideReason>
>
