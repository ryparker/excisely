'use server'

import { eq, and } from 'drizzle-orm'

import { db } from '@/db'
import {
  labels,
  applicants,
  validationItems,
  validationResults,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldSummary {
  fieldName: string
  expectedValue: string
  extractedValue: string
  status: string
  confidence: number
}

interface GetFieldSummaryResult {
  success: boolean
  fields?: FieldSummary[]
  error?: string
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Lightweight field summary for expandable quick review rows.
 * Returns only field name, values, status, and confidence — no bounding boxes.
 */
export async function getLabelFieldSummary(
  labelId: string,
): Promise<GetFieldSummaryResult> {
  const session = await getSession()
  if (!session?.user) {
    return { success: false, error: 'Authentication required' }
  }

  // Applicants can only access their own labels
  if (session.user.role === 'applicant') {
    const [applicantRecord] = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(eq(applicants.contactEmail, session.user.email))
      .limit(1)

    if (!applicantRecord) {
      return { success: false, error: 'Label not found' }
    }

    const [ownedLabel] = await db
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(eq(labels.id, labelId), eq(labels.applicantId, applicantRecord.id)),
      )
      .limit(1)

    if (!ownedLabel) {
      return { success: false, error: 'Label not found' }
    }
  }

  try {
    // Get current validation result
    const [currentResult] = await db
      .select({ id: validationResults.id })
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, labelId),
          eq(validationResults.isCurrent, true),
        ),
      )
      .limit(1)

    if (!currentResult) {
      return { success: false, error: 'No validation results found' }
    }

    const items = await db
      .select({
        fieldName: validationItems.fieldName,
        expectedValue: validationItems.expectedValue,
        extractedValue: validationItems.extractedValue,
        status: validationItems.status,
        confidence: validationItems.confidence,
      })
      .from(validationItems)
      .where(eq(validationItems.validationResultId, currentResult.id))

    const fields: FieldSummary[] = items.map((item) => ({
      fieldName: item.fieldName,
      expectedValue: item.expectedValue,
      extractedValue: item.extractedValue,
      status: item.status,
      confidence: Number(item.confidence),
    }))

    return { success: true, fields }
  } catch (error) {
    console.error('[getLabelFieldSummary] Error:', error)
    return { success: false, error: 'Failed to load field summary' }
  }
}
