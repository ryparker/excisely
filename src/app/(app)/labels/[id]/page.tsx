import type { Metadata } from 'next'
import { Suspense } from 'react'
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
import type { Label, ApplicationData, Applicant } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { buildTimeline } from '@/lib/timeline/build-timeline'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StatusBadge } from '@/components/shared/status-badge'
import { ReanalyzeButton } from '@/components/shared/reanalyze-button'
import { ReanalysisGuard } from '@/components/shared/reanalysis-guard'
import { StatusOverrideDialog } from '@/components/shared/status-override-dialog'
import { ValidationSummary } from '@/components/validation/validation-summary'
import { ValidationDetailPanels } from '@/components/validation/validation-detail-panels'
import { ReviewDetailPanels } from '@/components/review/review-detail-panels'
import { ProcessingStatusBanner } from '@/components/validation/processing-status-banner'
import { ProcessingDetailPanels } from '@/components/validation/processing-detail-panels'
import { AutoRefresh } from '@/components/shared/auto-refresh'
import { HorizontalTimeline } from '@/components/timeline/horizontal-timeline'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const [row] = await db
    .select({ brandName: applicationData.brandName })
    .from(applicationData)
    .where(eq(applicationData.labelId, id))
    .limit(1)
  return { title: row?.brandName ?? 'Label Detail' }
}

export const dynamic = 'force-dynamic'

const REVIEWABLE_STATUSES = new Set([
  'pending_review',
  'needs_correction',
  'conditionally_approved',
])

// ---------------------------------------------------------------------------
// Skeleton components for Suspense fallbacks
// ---------------------------------------------------------------------------

function ContentSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 rounded-lg" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="shrink-0 lg:w-[55%]">
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-48" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineSkeleton() {
  return <Skeleton className="h-16 rounded-lg" />
}

// ---------------------------------------------------------------------------
// Async section: Label content (images, validation items, summary)
// ---------------------------------------------------------------------------

async function LabelContentSection({
  labelId,
  label,
  appData,
  effectiveStatus,
  isReviewable,
}: {
  labelId: string
  label: Label
  appData: ApplicationData | null
  effectiveStatus: string
  isReviewable: boolean
}) {
  // Fetch images + current results in parallel
  const [images, results] = await Promise.all([
    db
      .select()
      .from(labelImages)
      .where(eq(labelImages.labelId, labelId))
      .orderBy(labelImages.sortOrder),
    db
      .select()
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, labelId),
          eq(validationResults.isCurrent, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  // Fetch items (depends on results.id)
  const items = results
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, results.id))
    : []

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
    bboxAngle: item.bboxAngle,
    labelImageId: item.labelImageId,
  }))

  return (
    <ReanalysisGuard
      labelId={label.id}
      labelStatus={label.status}
      processingContent={
        <div className="space-y-5">
          <AutoRefresh intervalMs={3_000} />
          <ProcessingStatusBanner imageCount={images.length} />
          {signedImages.length > 0 && (
            <ProcessingDetailPanels
              images={signedImages}
              appData={appData as Record<string, unknown> | null}
              beverageType={label.beverageType}
              containerSizeMl={label.containerSizeMl}
            />
          )}
        </div>
      }
      normalContent={
        <div className="space-y-5">
          {/* Compact summary strip — no box */}
          <ValidationSummary
            status={effectiveStatus}
            confidence={confidence}
            processingTimeMs={results?.processingTimeMs ?? null}
            modelUsed={results?.modelUsed ?? null}
            fieldCounts={fieldCounts}
            aiProposedStatus={label.aiProposedStatus}
            inputTokens={results?.inputTokens}
            outputTokens={results?.outputTokens}
            totalTokens={results?.totalTokens}
          />

          {/* Two-panel layout: image + field list */}
          {signedImages.length > 0 && items.length > 0 ? (
            isReviewable ? (
              <ReviewDetailPanels
                labelId={label.id}
                images={signedImages}
                validationItems={mappedItems}
                beverageType={label.beverageType}
                applicantCorrections={
                  (results?.aiRawResponse as Record<string, unknown>)
                    ?.applicantCorrections as
                    | Array<{
                        fieldName: string
                        aiExtractedValue: string
                        applicantSubmittedValue: string
                      }>
                    | undefined
                }
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
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Async section: Correspondence timeline
// ---------------------------------------------------------------------------

async function LabelTimelineSection({
  labelId,
  label,
  appData,
  applicant,
  effectiveStatus,
}: {
  labelId: string
  label: Label
  appData: ApplicationData | null
  applicant: Applicant | null
  effectiveStatus: string
}) {
  // Fetch results, reviews, overrides, superseded results ALL in parallel
  const [results, reviews, overrides, supersededResults] = await Promise.all([
    db
      .select()
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, labelId),
          eq(validationResults.isCurrent, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
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
      .where(eq(humanReviews.labelId, labelId))
      .orderBy(humanReviews.reviewedAt),
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
      .where(eq(statusOverrides.labelId, labelId))
      .orderBy(desc(statusOverrides.createdAt)),
    db
      .select({
        id: validationResults.id,
        createdAt: validationResults.createdAt,
        modelUsed: validationResults.modelUsed,
        processingTimeMs: validationResults.processingTimeMs,
        totalTokens: validationResults.totalTokens,
      })
      .from(validationResults)
      .where(
        and(
          eq(validationResults.labelId, labelId),
          eq(validationResults.isCurrent, false),
        ),
      )
      .orderBy(desc(validationResults.createdAt)),
  ])

  // Fetch items (depends on results.id)
  const items = results
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, results.id))
    : []

  const hasSupersededResults = supersededResults.length > 0

  return (
    <HorizontalTimeline
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
        validationResult: results
          ? {
              createdAt: results.createdAt,
              processingTimeMs: results.processingTimeMs,
            }
          : null,
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
        supersededResults: supersededResults.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          modelUsed: r.modelUsed,
          processingTimeMs: r.processingTimeMs,
          totalTokens: r.totalTokens,
        })),
        isReanalysis: hasSupersededResults,
      })}
    />
  )
}

// ---------------------------------------------------------------------------
// Page component

// ---------------------------------------------------------------------------

interface LabelDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LabelDetailPage({
  params,
}: LabelDetailPageProps) {
  await requireSpecialist()

  const { id } = await params

  // Stage 1: Fetch label (needed for notFound check)
  const [label] = await db
    .select()
    .from(labels)
    .where(eq(labels.id, id))
    .limit(1)

  if (!label) {
    notFound()
  }

  // Stage 2: Fetch appData + applicant in parallel (needed for header)
  const [appData, applicant] = await Promise.all([
    db
      .select()
      .from(applicationData)
      .where(eq(applicationData.labelId, id))
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

  // Compute effective status with lazy deadline expiration
  const effectiveStatus = getEffectiveStatus({
    status: label.status,
    correctionDeadline: label.correctionDeadline,
    deadlineExpired: label.deadlineExpired,
  })

  const isReviewable = REVIEWABLE_STATUSES.has(effectiveStatus)
  const brandName = appData?.brandName ?? 'Untitled Label'

  return (
    <PageShell className="space-y-5">
      {/* Back link + header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Labels
          </Link>
        </Button>

        <div className="space-y-1">
          <PageHeader
            title={brandName}
            description={
              appData?.serialNumber
                ? `Serial Number: ${appData.serialNumber}`
                : undefined
            }
          >
            <StatusBadge
              status={effectiveStatus}
              className="px-3 py-1 text-sm"
            />
            {effectiveStatus !== 'pending' &&
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
                  <span className="text-muted-foreground/40">·</span>
                  <span>{applicant.contactName}</span>
                </>
              )}
              {applicant.contactEmail && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{applicant.contactEmail}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Correspondence timeline — streams independently */}
      <Suspense fallback={<TimelineSkeleton />}>
        <LabelTimelineSection
          labelId={label.id}
          label={label}
          appData={appData}
          applicant={applicant}
          effectiveStatus={effectiveStatus}
        />
      </Suspense>

      {/* Content area — streams independently */}
      <Suspense fallback={<ContentSkeleton />}>
        <LabelContentSection
          labelId={label.id}
          label={label}
          appData={appData}
          effectiveStatus={effectiveStatus}
          isReviewable={isReviewable}
        />
      </Suspense>
    </PageShell>
  )
}
