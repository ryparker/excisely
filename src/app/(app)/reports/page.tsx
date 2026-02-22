import { eq, sql, count, and, gte, avg } from 'drizzle-orm'
import { BarChart3, Clock, Gauge, TrendingUp } from 'lucide-react'

import { db } from '@/db'
import { labels, validationItems, validationResults } from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { PageHeader } from '@/components/layout/page-header'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { StatusDistributionChart } from '@/components/reports/status-distribution-chart'
import { ValidationTrendsChart } from '@/components/reports/validation-trends-chart'
import { FieldAccuracyChart } from '@/components/reports/field-accuracy-chart'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) return null

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    statusDistribution,
    dailyTrends,
    fieldAccuracy,
    avgConfidenceResult,
    avgProcessingTimeResult,
    totalValidationsResult,
    todayValidationsResult,
  ] = await Promise.all([
    // Labels by status
    db
      .select({
        status: labels.status,
        count: count(),
      })
      .from(labels)
      .groupBy(labels.status),

    // Labels per day (last 30 days)
    db
      .select({
        date: sql<string>`to_char(${labels.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(labels)
      .where(gte(labels.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${labels.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${labels.createdAt}, 'YYYY-MM-DD')`),

    // Per-field match rates
    db
      .select({
        fieldName: validationItems.fieldName,
        total: count(),
        matches: count(
          sql`CASE WHEN ${validationItems.status} = 'match' THEN 1 END`,
        ),
      })
      .from(validationItems)
      .innerJoin(
        validationResults,
        and(
          eq(validationItems.validationResultId, validationResults.id),
          eq(validationResults.isCurrent, true),
        ),
      )
      .groupBy(validationItems.fieldName),

    // Average confidence
    db
      .select({
        avgConfidence: avg(labels.overallConfidence),
      })
      .from(labels)
      .where(sql`${labels.overallConfidence} IS NOT NULL`),

    // Average processing time
    db
      .select({
        avgTime: avg(validationResults.processingTimeMs),
      })
      .from(validationResults)
      .where(eq(validationResults.isCurrent, true)),

    // Total validations
    db.select({ total: count() }).from(labels),

    // Today's validations
    db
      .select({ total: count() })
      .from(labels)
      .where(gte(labels.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))),
  ])

  // Fill in missing days for the trends chart
  const trendMap = new Map(dailyTrends.map((row) => [row.date, row.count]))
  const filledTrends: Array<{ date: string; count: number }> = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]!
    filledTrends.push({
      date: dateStr,
      count: trendMap.get(dateStr) ?? 0,
    })
  }

  // Compute field accuracy data
  const fieldAccuracyData = fieldAccuracy.map((row) => ({
    fieldName: row.fieldName,
    matchRate: row.total > 0 ? row.matches / row.total : 0,
    total: row.total,
  }))

  // Summary stats
  const avgConfidence = avgConfidenceResult[0]?.avgConfidence
    ? Math.round(Number(avgConfidenceResult[0].avgConfidence) * 100)
    : 0
  const avgProcessingTime = avgProcessingTimeResult[0]?.avgTime
    ? Math.round(Number(avgProcessingTimeResult[0].avgTime))
    : 0
  const totalValidations = totalValidationsResult[0]?.total ?? 0
  const todayValidations = todayValidationsResult[0]?.total ?? 0

  const stats = [
    {
      label: 'Total Validations',
      value: totalValidations,
      icon: BarChart3,
      description: 'All time',
    },
    {
      label: 'Today',
      value: todayValidations,
      icon: TrendingUp,
      description: 'Labels validated today',
    },
    {
      label: 'Avg. Confidence',
      value: `${avgConfidence}%`,
      icon: Gauge,
      description: 'Across all labels',
    },
    {
      label: 'Avg. Processing Time',
      value:
        avgProcessingTime > 1000
          ? `${(avgProcessingTime / 1000).toFixed(1)}s`
          : `${avgProcessingTime}ms`,
      icon: Clock,
      description: 'Per label validation',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Analytics and insights across all label validations."
      />

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusDistributionChart data={statusDistribution} />
        <ValidationTrendsChart data={filledTrends} />
      </div>

      <FieldAccuracyChart data={fieldAccuracyData} />
    </div>
  )
}
