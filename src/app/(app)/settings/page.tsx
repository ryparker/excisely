import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Settings',
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton({ height = 'h-[200px]' }: { height?: string }) {
  return <Skeleton className={`${height} rounded-xl`} />
}

// ---------------------------------------------------------------------------
// Async section: Confidence Threshold
// ---------------------------------------------------------------------------

async function ConfidenceSectionData() {
  const [{ confidenceThreshold }, avgAllResult, avgNotAutoApprovedResult] =
    await Promise.all([
      getSettings(),
      db
        .select({
          avg: sql<number>`round(avg(${labels.overallConfidence}::numeric))::int`,
        })
        .from(labels)
        .where(sql`${labels.overallConfidence} IS NOT NULL`),
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
    ])

  return (
    <ConfidenceThreshold
      defaultValue={confidenceThreshold}
      avgConfidence={avgAllResult[0]?.avg ?? null}
      avgNotAutoApproved={avgNotAutoApprovedResult[0]?.avg ?? null}
    />
  )
}

// ---------------------------------------------------------------------------
// Async section: Auto-Approval Toggle
// ---------------------------------------------------------------------------

async function AutoApprovalSectionData() {
  const autoApprovalEnabled = await getAutoApprovalEnabled()
  return <AutoApprovalToggle defaultValue={autoApprovalEnabled} />
}

// ---------------------------------------------------------------------------
// Async section: Approval Threshold
// ---------------------------------------------------------------------------

async function ApprovalThresholdSectionData() {
  const approvalThreshold = await getApprovalThreshold()
  return <ApprovalThreshold defaultValue={approvalThreshold} />
}

// ---------------------------------------------------------------------------
// Async section: Field Strictness
// ---------------------------------------------------------------------------

async function FieldStrictnessSectionData() {
  const [{ fieldStrictness }, fieldMatchRateRows, fieldOverrideRateRows] =
    await Promise.all([
      getSettings(),
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
    <FieldStrictness
      defaults={fieldStrictness}
      fieldMatchRates={fieldMatchRates}
      fieldOverrideRates={fieldOverrideRates}
    />
  )
}

// ---------------------------------------------------------------------------
// Async section: SLA Settings
// ---------------------------------------------------------------------------

async function SLASectionData() {
  const slaTargets = await getSLATargets()
  return <SLASettings defaults={slaTargets} />
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SectionHeading({
  title,
  description,
  first,
}: {
  title: string
  description: string
  first?: boolean
}) {
  return (
    <div className={first ? '' : 'border-t pt-6'}>
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default async function SettingsPage() {
  await connection()
  await requireSpecialist()

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure AI verification thresholds and field comparison rules."
      />

      {/* --- AI Thresholds --- */}
      <SectionHeading
        title="AI Thresholds"
        description="Control how the AI pipeline scores and routes labels."
        first
      />

      <Suspense fallback={<SettingsSkeleton />}>
        <ConfidenceSectionData />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<SettingsSkeleton />}>
          <AutoApprovalSectionData />
        </Suspense>
        <Suspense fallback={<SettingsSkeleton />}>
          <ApprovalThresholdSectionData />
        </Suspense>
      </div>

      {/* --- Field Comparison --- */}
      <SectionHeading
        title="Field Comparison"
        description="Fine-tune how strictly each field is matched between application data and extracted label text."
      />

      <Suspense fallback={<SettingsSkeleton height="h-[400px]" />}>
        <FieldStrictnessSectionData />
      </Suspense>

      {/* --- Operations --- */}
      <SectionHeading
        title="Operations"
        description="Service level targets for review turnaround."
      />

      <Suspense fallback={<SettingsSkeleton />}>
        <SLASectionData />
      </Suspense>
    </PageShell>
  )
}
