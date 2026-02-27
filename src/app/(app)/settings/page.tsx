import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

import {
  getApprovalThreshold,
  getSettings,
  getSLATargets,
  getSubmissionPipelineModel,
} from '@/db/queries/settings'
import { getFieldMatchRates, getFieldOverrideRates } from '@/db/queries/stats'
import { getCloudApiStatus } from '@/lib/ai/cloud-available'
import { requireSpecialist } from '@/lib/auth/require-role'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Section } from '@/components/shared/Section'
import { ApprovalThreshold } from '@/components/settings/ApprovalThreshold'
import { FieldStrictness } from '@/components/settings/FieldStrictness'
import { SLASettings } from '@/components/settings/SlaSettings'
import { SubmissionPipeline } from '@/components/settings/SubmissionPipeline'
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
// Async section: Approval Threshold
// ---------------------------------------------------------------------------

async function ApprovalThresholdSectionData() {
  const approvalThreshold = await getApprovalThreshold()
  return <ApprovalThreshold defaultValue={approvalThreshold} />
}

// ---------------------------------------------------------------------------
// Async section: Submission Pipeline
// ---------------------------------------------------------------------------

async function SubmissionPipelineSectionData() {
  const [model, cloudStatus] = await Promise.all([
    getSubmissionPipelineModel(),
    getCloudApiStatus(),
  ])
  return (
    <SubmissionPipeline
      defaultValue={model}
      cloudAvailable={cloudStatus.available}
    />
  )
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
        <Suspense fallback={<SettingsSkeleton />}>
          <ApprovalThresholdSectionData />
        </Suspense>
      </Section>

      {/* --- Submission Pipeline --- */}
      <Section
        title="Submission Pipeline"
        description="Choose the OCR model used when processing new label submissions."
        className="border-t pt-6"
      >
        <Suspense fallback={<SettingsSkeleton />}>
          <SubmissionPipelineSectionData />
        </Suspense>
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
