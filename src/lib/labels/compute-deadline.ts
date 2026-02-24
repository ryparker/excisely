import {
  CONDITIONAL_DEADLINE_DAYS,
  CORRECTION_DEADLINE_DAYS,
} from '@/config/constants'
import { addDays } from '@/lib/labels/validation-helpers'

/**
 * Computes the correction deadline for a given label status.
 * - `conditionally_approved` → 7-day window
 * - `needs_correction` → 30-day window
 * - All other statuses → null (no deadline)
 */
export function computeCorrectionDeadline(status: string): Date | null {
  if (status === 'conditionally_approved')
    return addDays(new Date(), CONDITIONAL_DEADLINE_DAYS)
  if (status === 'needs_correction')
    return addDays(new Date(), CORRECTION_DEADLINE_DAYS)
  return null
}
