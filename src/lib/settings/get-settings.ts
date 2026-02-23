import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { settings } from '@/db/schema'

const DEFAULT_CONFIDENCE_THRESHOLD = 80

const DEFAULT_FIELD_STRICTNESS: Record<string, string> = {
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
  autoApprovalRateTarget: number
  maxQueueDepth: number
}

const DEFAULT_SLA_TARGETS: SLATargets = {
  reviewResponseHours: 48,
  totalTurnaroundHours: 72,
  autoApprovalRateTarget: 70,
  maxQueueDepth: 50,
}

async function getSettingValue<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (!row) return null
  return row.value as T
}

export async function getSettings(): Promise<{
  confidenceThreshold: number
  fieldStrictness: Record<string, string>
}> {
  const [threshold, strictness] = await Promise.all([
    getConfidenceThreshold(),
    getFieldStrictness(),
  ])

  return {
    confidenceThreshold: threshold,
    fieldStrictness: strictness,
  }
}

export async function getConfidenceThreshold(): Promise<number> {
  const value = await getSettingValue<number>('confidence_threshold')
  return value ?? DEFAULT_CONFIDENCE_THRESHOLD
}

export async function getFieldStrictness(): Promise<Record<string, string>> {
  const value =
    await getSettingValue<Record<string, string>>('field_strictness')
  return value ?? { ...DEFAULT_FIELD_STRICTNESS }
}

export async function getSLATargets(): Promise<SLATargets> {
  const value = await getSettingValue<SLATargets>('sla_targets')
  return value ?? { ...DEFAULT_SLA_TARGETS }
}
