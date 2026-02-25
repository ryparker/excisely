import { and, count, eq, gte, isNotNull, sql, sum } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { humanReviews, labels, validationResults } from '@/db/schema'

export interface SLAMetrics {
  avgReviewResponseHours: number | null
  avgTotalTurnaroundHours: number | null
  queueDepth: number
}

const DEFAULT_SLA_METRICS: SLAMetrics = {
  avgReviewResponseHours: null,
  avgTotalTurnaroundHours: null,
  queueDepth: 0,
}

/** Fetch all 4 SLA metrics (last 30 days). Returns defaults on DB failure. */
export async function fetchSLAMetrics(): Promise<SLAMetrics> {
  'use cache'
  cacheTag('sla-metrics')
  cacheLife('minutes')

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [avgReviewResponse, avgTurnaround, queueResult] = await Promise.all([
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

      // Queue depth (pending_review only)
      db
        .select({ total: count() })
        .from(labels)
        .where(eq(labels.status, 'pending_review')),
    ])

    return {
      avgReviewResponseHours: avgReviewResponse[0]?.avgHours ?? null,
      avgTotalTurnaroundHours: avgTurnaround[0]?.avgHours ?? null,
      queueDepth: queueResult[0]?.total ?? 0,
    }
  } catch (error) {
    console.error('[SLA] Failed to fetch metrics:', error)
    return DEFAULT_SLA_METRICS
  }
}

// ---------------------------------------------------------------------------
// Token Usage Metrics
// ---------------------------------------------------------------------------

export interface TokenUsageMetrics {
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  validationCount: number
  avgTokensPerValidation: number | null
}

const DEFAULT_TOKEN_METRICS: TokenUsageMetrics = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  validationCount: 0,
  avgTokensPerValidation: null,
}

/** Fetch aggregated token usage from validation results (last 30 days). Returns defaults on DB failure. */
export async function fetchTokenUsageMetrics(): Promise<TokenUsageMetrics> {
  'use cache'
  cacheTag('sla-metrics')
  cacheLife('minutes')

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [result] = await db
      .select({
        totalInputTokens: sum(validationResults.inputTokens),
        totalOutputTokens: sum(validationResults.outputTokens),
        totalTokens: sum(validationResults.totalTokens),
        validationCount: count(),
      })
      .from(validationResults)
      .where(
        and(
          isNotNull(validationResults.totalTokens),
          gte(validationResults.createdAt, thirtyDaysAgo),
        ),
      )

    const totalTokens = Number(result?.totalTokens) || 0
    const validationCount = result?.validationCount ?? 0

    return {
      totalInputTokens: Number(result?.totalInputTokens) || 0,
      totalOutputTokens: Number(result?.totalOutputTokens) || 0,
      totalTokens,
      validationCount,
      avgTokensPerValidation:
        validationCount > 0 ? Math.round(totalTokens / validationCount) : null,
    }
  } catch (error) {
    console.error('[SLA] Failed to fetch token usage:', error)
    return DEFAULT_TOKEN_METRICS
  }
}
