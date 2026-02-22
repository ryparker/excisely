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
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { ValidationSummary } from '@/components/validation/validation-summary'
import { ReviewDetailPanels } from '@/components/review/review-detail-panels'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params

  // Fetch label
  const [label] = await db
    .select()
    .from(labels)
    .where(eq(labels.id, id))
    .limit(1)

  if (!label) {
    notFound()
  }

  // Compute effective status with lazy deadline expiration
  const effectiveStatus = getEffectiveStatus({
    status: label.status,
    correctionDeadline: label.correctionDeadline,
    deadlineExpired: label.deadlineExpired,
  })

  // Only allow review for labels that need correction or are conditionally approved
  const reviewableStatuses = ['needs_correction', 'conditionally_approved']
  if (!reviewableStatuses.includes(effectiveStatus)) {
    notFound()
  }

  // Fetch all related data in parallel
  const [appData, images, result] = await Promise.all([
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
  ])

  // Fetch validation items for the current result
  const items = result
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, result.id))
    : []

  if (items.length === 0) {
    notFound()
  }

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
  const signedImageUrl = primaryImage
    ? await getSignedImageUrl(primaryImage.imageUrl)
    : null
  const confidence = label.overallConfidence
    ? Number(label.overallConfidence)
    : null

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/review">
            <ArrowLeft className="size-4" />
            Back to Review Queue
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
        processingTimeMs={result?.processingTimeMs ?? null}
        modelUsed={result?.modelUsed ?? null}
        fieldCounts={fieldCounts}
      />

      {/* Two-panel layout: image + review field list */}
      {primaryImage && signedImageUrl ? (
        <ReviewDetailPanels
          labelId={label.id}
          imageUrl={signedImageUrl}
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
          No label image available for review.
        </div>
      )}
    </div>
  )
}
