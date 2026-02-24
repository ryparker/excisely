'use client'

import { updateApprovalThreshold } from '@/app/actions/update-settings'
import { ThresholdSliderCard } from '@/components/settings/ThresholdSliderCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalThresholdProps {
  defaultValue: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApprovalThreshold({ defaultValue }: ApprovalThresholdProps) {
  return (
    <ThresholdSliderCard
      title="Batch Approval Threshold"
      description='Minimum confidence score for labels to appear in the "Ready to Approve" queue. Labels meeting this threshold with all fields matching can be batch-approved.'
      min={80}
      max={100}
      defaultValue={defaultValue}
      saveAction={updateApprovalThreshold}
      helpText="Range: 80%–100%. Higher values are stricter — fewer labels qualify for batch approval but with higher accuracy."
    />
  )
}
