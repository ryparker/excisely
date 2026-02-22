import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, and } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'

import { db } from '@/db'
import {
  labels,
  applicationData,
  labelImages,
  validationResults,
  validationItems,
  applicants,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { ValidationSummary } from '@/components/validation/validation-summary'
import { ValidationDetailPanels } from '@/components/validation/validation-detail-panels'
import { ReportMessage } from '@/components/communication/report-message'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

interface ValidationDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ValidationDetailPage({
  params,
}: ValidationDetailPageProps) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params

  // Fetch label with all related data
  const [label] = await db
    .select()
    .from(labels)
    .where(eq(labels.id, id))
    .limit(1)

  if (!label) {
    notFound()
  }

  const [appData, images, results, applicant] = await Promise.all([
    db
      .select()
      .from(applicationData)
      .where(eq(applicationData.labelId, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(labelImages)
      .where(eq(labelImages.labelId, id))
      .orderBy(labelImages.sortOrder),
    db
      .select()
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, id),
          eq(validationResults.isCurrent, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    label.applicantId
      ? db
          .select()
          .from(applicants)
          .where(eq(applicants.id, label.applicantId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null,
  ])

  // Fetch validation items for the current result
  const items = results
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, results.id))
    : []

  // Compute effective status with lazy deadline expiration
  const effectiveStatus = getEffectiveStatus({
    status: label.status,
    correctionDeadline: label.correctionDeadline,
    deadlineExpired: label.deadlineExpired,
  })

  // Compute field counts
  const fieldCounts = items.reduce(
    (acc, item) => {
      if (item.status === 'match') acc.match++
      else if (item.status === 'mismatch') acc.mismatch++
      else if (item.status === 'not_found') acc.notFound++
      else if (item.status === 'needs_correction') acc.needsCorrection++
      return acc
    },
    { match: 0, mismatch: 0, notFound: 0, needsCorrection: 0 },
  )

  const brandName = appData?.brandName ?? 'Untitled Label'
  const primaryImage = images[0]
  const confidence = label.overallConfidence
    ? Number(label.overallConfidence)
    : null

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/history">
            <ArrowLeft className="size-4" />
            Back to History
          </Link>
        </Button>

        <PageHeader
          title={brandName}
          description={
            appData?.serialNumber
              ? `Serial Number: ${appData.serialNumber}`
              : undefined
          }
        >
          <StatusBadge status={effectiveStatus} className="px-3 py-1 text-sm" />
        </PageHeader>
      </div>

      {/* Summary bar */}
      <ValidationSummary
        status={effectiveStatus}
        confidence={confidence}
        processingTimeMs={results?.processingTimeMs ?? null}
        modelUsed={results?.modelUsed ?? null}
        fieldCounts={fieldCounts}
      />

      {/* Two-panel layout: image + field comparisons */}
      {primaryImage && items.length > 0 ? (
        <ValidationDetailPanels
          imageUrl={primaryImage.imageUrl}
          validationItems={items.map((item) => ({
            id: item.id,
            fieldName: item.fieldName,
            expectedValue: item.expectedValue,
            extractedValue: item.extractedValue,
            status: item.status,
            confidence: item.confidence,
            matchReasoning: item.matchReasoning,
            bboxX: item.bboxX,
            bboxY: item.bboxY,
            bboxWidth: item.bboxWidth,
            bboxHeight: item.bboxHeight,
          }))}
        />
      ) : (
        <div className="flex items-center justify-center rounded-lg border py-24 text-sm text-muted-foreground">
          {label.status === 'pending' || label.status === 'processing'
            ? 'Validation results are not yet available. This label is still being processed.'
            : 'No validation data available for this label.'}
        </div>
      )}

      {/* Communication report */}
      {effectiveStatus !== 'pending' && effectiveStatus !== 'processing' && (
        <ReportMessage
          label={{
            status: effectiveStatus,
            correctionDeadline: label.correctionDeadline,
            applicationData: appData
              ? {
                  brandName: appData.brandName,
                  serialNumber: appData.serialNumber,
                }
              : null,
            applicant: applicant
              ? { companyName: applicant.companyName }
              : null,
          }}
          validationItems={items.map((item) => ({
            fieldName: item.fieldName,
            status: item.status,
            expectedValue: item.expectedValue,
            extractedValue: item.extractedValue,
          }))}
        />
      )}
    </div>
  )
}
