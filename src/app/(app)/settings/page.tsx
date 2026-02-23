import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { labels, validationItems, humanReviews } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import {
  getApprovalThreshold,
  getAutoApprovalEnabled,
  getSettings,
  getSLATargets,
} from '@/lib/settings/get-settings'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { ApprovalThreshold } from '@/components/settings/approval-threshold'
import { AutoApprovalToggle } from '@/components/settings/auto-approval-toggle'
import { ConfidenceThreshold } from '@/components/settings/confidence-threshold'
import { FieldStrictness } from '@/components/settings/field-strictness'
import { SLASettings } from '@/components/settings/sla-settings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireSpecialist()

  const [
    { confidenceThreshold, fieldStrictness },
    slaTargets,
    autoApprovalEnabled,
    approvalThreshold,
    avgAllResult,
    avgNotAutoApprovedResult,
    fieldMatchRateRows,
    fieldOverrideRateRows,
  ] = await Promise.all([
    getSettings(),
    getSLATargets(),
    getAutoApprovalEnabled(),
    getApprovalThreshold(),
    // Average confidence across all analyzed labels
    db
      .select({
        avg: sql<number>`round(avg(${labels.overallConfidence}::numeric))::int`,
      })
      .from(labels)
      .where(sql`${labels.overallConfidence} IS NOT NULL`),
    // Average confidence for labels that were NOT auto-approved
    db
      .select({
        avg: sql<number>`round(avg(${labels.overallConfidence}::numeric))::int`,
      })
      .from(labels)
      .where(
        sql`${labels.overallConfidence} IS NOT NULL AND (
          ${labels.status} IN ('pending_review', 'needs_correction', 'conditionally_approved', 'rejected')
          OR (${labels.status} = 'approved' AND EXISTS (
            SELECT 1 FROM human_reviews hr WHERE hr.label_id = ${labels.id}
          ))
        )`,
      ),
    // Per-field match rate: % of validation items that matched
    db
      .select({
        fieldName: validationItems.fieldName,
        matchRate: sql<number>`round(
          count(CASE WHEN ${validationItems.status} = 'match' THEN 1 END)::numeric
          / NULLIF(count(*), 0)::numeric * 100
        )::int`,
      })
      .from(validationItems)
      .groupBy(validationItems.fieldName),
    // Per-field override rate: of flagged items, % that a specialist overrode to match
    db
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
      .groupBy(validationItems.fieldName),
  ])

  const avgConfidence = avgAllResult[0]?.avg ?? null
  const avgNotAutoApproved = avgNotAutoApprovedResult[0]?.avg ?? null

  // Build per-field stats maps
  const fieldMatchRates: Record<string, number> = {}
  for (const row of fieldMatchRateRows) {
    fieldMatchRates[row.fieldName] = row.matchRate
  }
  const fieldOverrideRates: Record<string, number> = {}
  for (const row of fieldOverrideRateRows) {
    if (row.flaggedTotal > 0) {
      fieldOverrideRates[row.fieldName] = Math.round(
        (row.overriddenCount / row.flaggedTotal) * 100,
      )
    }
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure AI verification thresholds and field comparison rules."
      />

      <ConfidenceThreshold
        defaultValue={confidenceThreshold}
        avgConfidence={avgConfidence}
        avgNotAutoApproved={avgNotAutoApproved}
      />
      <AutoApprovalToggle defaultValue={autoApprovalEnabled} />
      <ApprovalThreshold defaultValue={approvalThreshold} />
      <FieldStrictness
        defaults={fieldStrictness}
        fieldMatchRates={fieldMatchRates}
        fieldOverrideRates={fieldOverrideRates}
      />
      <SLASettings defaults={slaTargets} />
    </PageShell>
  )
}
