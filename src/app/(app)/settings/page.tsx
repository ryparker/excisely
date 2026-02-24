import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

import {
  getApprovalThreshold,
  getAutoApprovalEnabled,
  getSettings,
  getSLATargets,
} from '@/db/queries/settings'
import {
  getAvgConfidence,
  getAvgConfidenceNonAutoApproved,
  getFieldMatchRates,
  getFieldOverrideRates,
} from '@/db/queries/stats'
import { requireSpecialist } from '@/lib/auth/require-role'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { ApprovalThreshold } from '@/components/settings/ApprovalThreshold'
import { AutoApprovalToggle } from '@/components/settings/AutoApprovalToggle'
import { ConfidenceThreshold } from '@/components/settings/ConfidenceThreshold'
import { FieldStrictness } from '@/components/settings/FieldStrictness'
import { SLASettings } from '@/components/settings/SlaSettings'
import { Skeleton } from '@/components/ui/Skeleton'

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
  const [{ confidenceThreshold }, avgConfidence, avgNotAutoApproved] =
    await Promise.all([
      getSettings(),
      getAvgConfidence(),
      getAvgConfidenceNonAutoApproved(),
    ])

  return (
    <ConfidenceThreshold
      defaultValue={confidenceThreshold}
      avgConfidence={avgConfidence}
      avgNotAutoApproved={avgNotAutoApproved}
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
  const [{ fieldStrictness }, fieldMatchRates, fieldOverrideRates] =
    await Promise.all([
      getSettings(),
      getFieldMatchRates(),
      getFieldOverrideRates(),
    ])

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
      <Section
        title="AI Thresholds"
        description="Control how the AI pipeline scores and routes labels."
      >
        <div className="space-y-6">
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
        </div>
      </Section>

      {/* --- Field Comparison --- */}
      <Section
        title="Field Comparison"
        description="Fine-tune how strictly each field is matched between application data and extracted label text."
        className="border-t pt-6"
      >
        <Suspense fallback={<SettingsSkeleton height="h-[400px]" />}>
          <FieldStrictnessSectionData />
        </Suspense>
      </Section>

      {/* --- Operations --- */}
      <Section
        title="Operations"
        description="Service level targets for review turnaround."
        className="border-t pt-6"
      >
        <Suspense fallback={<SettingsSkeleton />}>
          <SLASectionData />
        </Suspense>
      </Section>
    </PageShell>
  )
}
