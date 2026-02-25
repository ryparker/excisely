'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'

import { upsertSetting } from '@/db/mutations/settings'
import { guardSpecialist } from '@/lib/auth/action-guards'
import { logActionError } from '@/lib/actions/action-error'
import type { StrictnessLevel } from '@/db/queries/settings'
import type { ActionResult } from '@/lib/actions/result-types'

const updateApprovalThresholdSchema = z.object({
  approvalThreshold: z.number().min(80).max(100),
})

const updateStrictnessSchema = z.object({
  fieldStrictness: z.record(
    z.string(),
    z.enum(['strict', 'moderate', 'lenient']),
  ),
})

const updateSLASchema = z.object({
  reviewResponseHours: z.number().min(1).max(168),
  totalTurnaroundHours: z.number().min(1).max(168),
  maxQueueDepth: z.number().min(1).max(1000),
})

export async function updateApprovalThreshold(
  threshold: number,
): Promise<ActionResult> {
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  const parsed = updateApprovalThresholdSchema.safeParse({
    approvalThreshold: threshold,
  })
  if (!parsed.success) {
    return { success: false, error: 'Threshold must be between 80 and 100' }
  }

  try {
    await upsertSetting('approval_threshold', parsed.data.approvalThreshold)
    updateTag('settings')
    updateTag('labels')
    return { success: true }
  } catch (error) {
    return logActionError(
      'updateApprovalThreshold',
      error,
      'Failed to save approval threshold',
    )
  }
}

export async function updateFieldStrictness(
  fieldStrictness: Record<string, StrictnessLevel>,
): Promise<ActionResult> {
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  const parsed = updateStrictnessSchema.safeParse({ fieldStrictness })
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid strictness values. Must be strict, moderate, or lenient.',
    }
  }

  try {
    await upsertSetting('field_strictness', parsed.data.fieldStrictness)
    updateTag('settings')
    return { success: true }
  } catch (error) {
    return logActionError(
      'updateFieldStrictness',
      error,
      'Failed to save field strictness',
    )
  }
}

export async function updateSLATargets(targets: {
  reviewResponseHours: number
  totalTurnaroundHours: number
  maxQueueDepth: number
}): Promise<ActionResult> {
  const guard = await guardSpecialist()
  if (!guard.success) return guard

  const parsed = updateSLASchema.safeParse(targets)
  if (!parsed.success) {
    return { success: false, error: 'Invalid SLA target values' }
  }

  try {
    await upsertSetting('sla_targets', parsed.data)
    updateTag('settings')
    return { success: true }
  } catch (error) {
    return logActionError(
      'updateSLATargets',
      error,
      'Failed to save SLA targets',
    )
  }
}
