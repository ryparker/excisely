import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, and, desc } from 'drizzle-orm'
import { ArrowLeft, Building2 } from 'lucide-react'

import { db } from '@/db'
import {
  labels,
  applicationData,
  labelImages,
  validationResults,
  validationItems,
  applicants,
  statusOverrides,
  humanReviews,
  users,
} from '@/db/schema'
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { buildTimeline } from '@/lib/timeline/build-timeline'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { ReanalyzeButton } from '@/components/shared/reanalyze-button'
import { StatusOverrideDialog } from '@/components/shared/status-override-dialog'
import { ValidationSummary } from '@/components/validation/validation-summary'
import { ValidationDetailPanels } from '@/components/validation/validation-detail-panels'
import { ReviewDetailPanels } from '@/components/review/review-detail-panels'
import { ProcessingPipelineCard } from '@/components/validation/processing-pipeline-card'
import { CorrespondenceTimeline } from '@/components/timeline/correspondence-timeline'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const REVIEWABLE_STATUSES = new Set([
  'pending_review',
  'needs_correction',
  'conditionally_approved',
])

interface LabelDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LabelDetailPage({
  params,
}: LabelDetailPageProps) {
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

  // Fetch all related data in parallel
  const [appData, images, results, applicant, overrides, reviews] =
    await Promise.all([
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
      db
        .select({
          id: statusOverrides.id,
          previousStatus: statusOverrides.previousStatus,
          newStatus: statusOverrides.newStatus,
          justification: statusOverrides.justification,
          reasonCode: statusOverrides.reasonCode,
          createdAt: statusOverrides.createdAt,
          specialistName: users.name,
        })
        .from(statusOverrides)
        .innerJoin(users, eq(statusOverrides.specialistId, users.id))
        .where(eq(statusOverrides.labelId, id))
        .orderBy(desc(statusOverrides.createdAt)),
      db
        .select({
          id: humanReviews.id,
          fieldName: validationItems.fieldName,
          originalStatus: humanReviews.originalStatus,
          resolvedStatus: humanReviews.resolvedStatus,
          reviewerNotes: humanReviews.reviewerNotes,
          reviewedAt: humanReviews.reviewedAt,
          specialistName: users.name,
        })
        .from(humanReviews)
        .innerJoin(users, eq(humanReviews.specialistId, users.id))
        .leftJoin(
          validationItems,
          eq(humanReviews.validationItemId, validationItems.id),
        )
        .where(eq(humanReviews.labelId, id))
        .orderBy(humanReviews.reviewedAt),
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

  const isReviewable =
    REVIEWABLE_STATUSES.has(effectiveStatus) &&
    session.user.role !== 'applicant'

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
  const signedImages = images.map((img) => ({
    id: img.id,
    imageUrl: getSignedImageUrl(img.imageUrl),
    imageType: img.imageType,
    sortOrder: img.sortOrder,
  }))
  const confidence = label.overallConfidence
    ? Number(label.overallConfidence)
    : null

  const mappedItems = items.map((item) => ({
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
    labelImageId: item.labelImageId,
  }))

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Labels
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
          {session.user.role !== 'applicant' &&
            effectiveStatus !== 'pending' &&
            effectiveStatus !== 'processing' && (
              <>
                <ReanalyzeButton labelId={label.id} />
                <StatusOverrideDialog
                  labelId={label.id}
                  currentStatus={effectiveStatus}
                />
              </>
            )}
        </PageHeader>

        {/* Applicant info */}
        {applicant && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4 shrink-0" />
            <Link
              href={`/applicants/${applicant.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {applicant.companyName}
            </Link>
            {applicant.contactName && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{applicant.contactName}</span>
              </>
            )}
            {applicant.contactEmail && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{applicant.contactEmail}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Processing state — show pipeline card instead of empty results */}
      {label.status === 'pending' || label.status === 'processing' ? (
        <ProcessingPipelineCard
          labelId={label.id}
          imageCount={images.length}
          imageNames={images.map((img) => img.imageFilename)}
        />
      ) : (
        <>
          {/* Summary bar */}
          <ValidationSummary
            status={effectiveStatus}
            confidence={confidence}
            processingTimeMs={results?.processingTimeMs ?? null}
            modelUsed={results?.modelUsed ?? null}
            fieldCounts={fieldCounts}
            aiProposedStatus={label.aiProposedStatus}
          />

          {/* Two-panel layout: image + field list */}
          {signedImages.length > 0 && items.length > 0 ? (
            isReviewable ? (
              <ReviewDetailPanels
                labelId={label.id}
                images={signedImages}
                validationItems={mappedItems}
              />
            ) : (
              <ValidationDetailPanels
                images={signedImages}
                validationItems={mappedItems}
              />
            )
          ) : (
            <div className="flex items-center justify-center rounded-lg border py-24 text-sm text-muted-foreground">
              No validation data available for this label.
            </div>
          )}
        </>
      )}

      {/* Correspondence timeline */}
      <CorrespondenceTimeline
        events={buildTimeline({
          label: {
            id: label.id,
            status: label.status,
            correctionDeadline: label.correctionDeadline,
            createdAt: label.createdAt,
          },
          effectiveStatus,
          appData: appData
            ? {
                serialNumber: appData.serialNumber,
                brandName: appData.brandName,
              }
            : null,
          applicant,
          validationResult: results ? { createdAt: results.createdAt } : null,
          validationItems: items.map((item) => ({
            fieldName: item.fieldName,
            status: item.status,
            expectedValue: item.expectedValue,
            extractedValue: item.extractedValue,
          })),
          humanReviews: reviews.map((r) => ({
            id: r.id,
            fieldName: r.fieldName,
            originalStatus: r.originalStatus,
            resolvedStatus: r.resolvedStatus,
            reviewerNotes: r.reviewerNotes,
            reviewedAt: r.reviewedAt,
            specialistName: r.specialistName,
          })),
          overrides: overrides.map((o) => ({
            id: o.id,
            previousStatus: o.previousStatus,
            newStatus: o.newStatus,
            justification: o.justification,
            reasonCode: o.reasonCode,
            createdAt: o.createdAt,
            specialistName: o.specialistName,
          })),
        })}
      />
    </div>
  )
}
