import { eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'

import { db } from '@/db'
import { settings } from '@/db/schema'

export type StrictnessLevel = 'strict' | 'moderate' | 'lenient'

const DEFAULT_FIELD_STRICTNESS: Record<string, StrictnessLevel> = {
  brand_name: 'strict',
  fanciful_name: 'lenient',
  class_type: 'strict',
  alcohol_content: 'strict',
  net_contents: 'strict',
  health_warning: 'strict',
  name_and_address: 'moderate',
  qualifying_phrase: 'moderate',
  country_of_origin: 'moderate',
  grape_varietal: 'moderate',
  appellation_of_origin: 'moderate',
  vintage_year: 'strict',
  sulfite_declaration: 'strict',
  age_statement: 'moderate',
  state_of_distillation: 'moderate',
  standards_of_fill: 'strict',
}

export interface SLATargets {
  reviewResponseHours: number
  totalTurnaroundHours: number
  maxQueueDepth: number
}

const DEFAULT_SLA_TARGETS: SLATargets = {
  reviewResponseHours: 48,
  totalTurnaroundHours: 72,
  maxQueueDepth: 50,
}

async function getSettingValue<T>(key: string): Promise<T | null> {
  'use cache'
  cacheTag('settings')
  cacheLife('hours')

  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (!row) return null
  return row.value as T
}

export async function getSettings(): Promise<{
  fieldStrictness: Record<string, StrictnessLevel>
}> {
  return { fieldStrictness: await getFieldStrictness() }
}

export async function getFieldStrictness(): Promise<
  Record<string, StrictnessLevel>
> {
  const value =
    await getSettingValue<Record<string, StrictnessLevel>>('field_strictness')
  return value ?? { ...DEFAULT_FIELD_STRICTNESS }
}

export async function getSLATargets(): Promise<SLATargets> {
  const value = await getSettingValue<SLATargets>('sla_targets')
  return value ?? { ...DEFAULT_SLA_TARGETS }
}

export type SubmissionPipelineModel = 'cloud' | 'local'

export async function getSubmissionPipelineModel(): Promise<SubmissionPipelineModel> {
  const value = await getSettingValue<SubmissionPipelineModel>(
    'submission_pipeline_model',
  )
  return value ?? 'local'
}

const DEFAULT_APPROVAL_THRESHOLD = 90

export async function getApprovalThreshold(): Promise<number> {
  const value = await getSettingValue<number>('approval_threshold')
  return value ?? DEFAULT_APPROVAL_THRESHOLD
}
