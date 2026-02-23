import { and, count, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { humanReviews, labels } from '@/db/schema'

export interface SLAMetrics {
  avgReviewResponseHours: number | null
  avgTotalTurnaroundHours: number | null
  autoApprovalRate: number | null
  queueDepth: number
}

/** Fetch all 4 SLA metrics (last 30 days). */
export async function fetchSLAMetrics(): Promise<SLAMetrics> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [avgReviewResponse, avgTurnaround, autoApprovalResult, queueResult] =
    await Promise.all([
      // Avg hours from label creation to first human review
      db
        .select({
          avgHours: sql<number>`avg(extract(epoch from ${humanReviews.reviewedAt} - ${labels.createdAt}) / 3600)`,
        })
        .from(humanReviews)
        .innerJoin(labels, eq(humanReviews.labelId, labels.id))
        .where(gte(humanReviews.reviewedAt, thirtyDaysAgo)),

      // Avg hours from label creation to final status
      db
        .select({
          avgHours: sql<number>`avg(extract(epoch from ${labels.updatedAt} - ${labels.createdAt}) / 3600)`,
        })
        .from(labels)
        .where(
          and(
            gte(labels.updatedAt, thirtyDaysAgo),
            sql`${labels.status} IN ('approved', 'rejected', 'needs_correction', 'conditionally_approved')`,
          ),
        ),

      // Auto-approval: labels approved with no human reviews
      db
        .select({
          total: count(),
          autoApproved: count(
            sql`CASE WHEN ${labels.status} = 'approved' AND NOT EXISTS (
              SELECT 1 FROM human_reviews hr WHERE hr.label_id = ${labels.id}
            ) THEN 1 END`,
          ),
        })
        .from(labels)
        .where(
          and(
            gte(labels.createdAt, thirtyDaysAgo),
            sql`${labels.status} IN ('approved', 'rejected', 'needs_correction', 'conditionally_approved')`,
          ),
        ),

      // Queue depth (pending_review only)
      db
        .select({ total: count() })
        .from(labels)
        .where(eq(labels.status, 'pending_review')),
    ])

  return {
    avgReviewResponseHours: avgReviewResponse[0]?.avgHours ?? null,
    avgTotalTurnaroundHours: avgTurnaround[0]?.avgHours ?? null,
    autoApprovalRate:
      autoApprovalResult[0]?.total && autoApprovalResult[0].total > 0
        ? Math.round(
            (autoApprovalResult[0].autoApproved / autoApprovalResult[0].total) *
              100,
          )
        : null,
    queueDepth: queueResult[0]?.total ?? 0,
  }
}
