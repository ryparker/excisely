import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, and } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'

import { routes } from '@/config/routes'
import { db } from '@/db'
import {
  labels,
  applicationData,
  labelImages,
  validationResults,
  validationItems,
  applicants,
} from '@/db/schema'
import type { Label, ApplicationData } from '@/db/schema'
import { requireApplicant } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { buildApplicantTimeline } from '@/lib/timeline/build-timeline'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StatusBadge } from '@/components/shared/status-badge'
import { AutoRefresh } from '@/components/shared/auto-refresh'
import { ValidationDetailPanels } from '@/components/validation/validation-detail-panels'
import { ProcessingStatusBanner } from '@/components/validation/processing-status-banner'
import { ProcessingDetailPanels } from '@/components/validation/processing-detail-panels'
import { HorizontalTimeline } from '@/components/timeline/horizontal-timeline'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'

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
  return { title: row?.brandName ?? 'Submission Detail' }
}

export const dynamic = 'force-dynamic'

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
          {Array.from({ length: 4 }).map((_, i) => (
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
// Async section: Submission content (images, validation items, status card)
// ---------------------------------------------------------------------------

async function SubmissionContentSection({
  labelId,
  label,
  appData,
  isProcessing,
}: {
  labelId: string
  label: Label
  appData: ApplicationData | null
  isProcessing: boolean
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

  const signedImages = images.map((img) => ({
    id: img.id,
    imageUrl: getSignedImageUrl(img.imageUrl),
    imageType: img.imageType,
    sortOrder: img.sortOrder,
  }))

  // Strip confidence and reasoning from mapped items (applicant view)
  const mappedItems = items.map((item) => ({
    id: item.id,
    fieldName: item.fieldName,
    expectedValue: item.expectedValue,
    extractedValue: item.extractedValue,
    status: item.status,
    confidence: '0',
    matchReasoning: null,
    bboxX: item.bboxX,
    bboxY: item.bboxY,
    bboxWidth: item.bboxWidth,
    bboxHeight: item.bboxHeight,
    bboxAngle: item.bboxAngle,
    labelImageId: item.labelImageId,
  }))

  if (isProcessing) {
    return (
      <>
        <ProcessingStatusBanner imageCount={images.length} />
        {signedImages.length > 0 && (
          <ProcessingDetailPanels
            images={signedImages}
            appData={appData as Record<string, unknown> | null}
            beverageType={label.beverageType}
            containerSizeMl={label.containerSizeMl}
          />
        )}
      </>
    )
  }

  if (signedImages.length > 0 && items.length > 0) {
    return (
      <ValidationDetailPanels
        images={signedImages}
        validationItems={mappedItems}
        hideInternals
      />
    )
  }

  return (
    <div className="flex items-center justify-center rounded-lg border py-24 text-sm text-muted-foreground">
      No verification data available for this submission.
    </div>
  )
}

// ---------------------------------------------------------------------------
// Async section: Applicant-safe timeline
// ---------------------------------------------------------------------------

async function SubmissionTimelineSection({
  labelId,
  label,
  appData,
  applicantRecord,
  effectiveStatus,
}: {
  labelId: string
  label: Label
  appData: ApplicationData | null
  applicantRecord: {
    id: string
    companyName: string
    contactName: string | null
    contactEmail: string | null
  }
  effectiveStatus: string
}) {
  // Fetch results
  const results = await db
    .select()
    .from(validationResults)
    .where(
      and(
        eq(validationResults.labelId, labelId),
        eq(validationResults.isCurrent, true),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)

  // Fetch items (depends on results.id)
  const items = results
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, results.id))
    : []

  const GUIDANCE: Record<string, string> = {
    pending_review:
      'A labeling specialist will review the AI analysis and your application. You should hear back within 3 business days.',
    approved:
      'Your label is approved. You may proceed with printing and distribution.',
    conditionally_approved:
      'Your label has been conditionally approved. Please review the flagged fields and submit corrections within 7 days.',
    needs_correction:
      'Some fields on your label need attention. Review the flagged items and resubmit corrections within 30 days.',
    rejected:
      'Please review the notes below. You may submit a revised application.',
  }

  return (
    <HorizontalTimeline
      events={buildApplicantTimeline({
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
        applicant: applicantRecord,
        validationResult: results ? { createdAt: results.createdAt } : null,
        validationItems: items.map((item) => ({
          fieldName: item.fieldName,
          status: item.status,
          expectedValue: item.expectedValue,
          extractedValue: item.extractedValue,
        })),
        humanReviews: [],
        overrides: [],
      })}
      guidance={GUIDANCE[effectiveStatus]}
    />
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface SubmissionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const session = await requireApplicant()

  const { id } = await params

  // Stage 1: Find applicant record by email
  const [applicantRecord] = await db
    .select({
      id: applicants.id,
      companyName: applicants.companyName,
      contactName: applicants.contactName,
      contactEmail: applicants.contactEmail,
    })
    .from(applicants)
    .where(eq(applicants.contactEmail, session.user.email))
    .limit(1)

  if (!applicantRecord) notFound()

  // Stage 2: Fetch label + appData in parallel
  const [[label], appData] = await Promise.all([
    db
      .select()
      .from(labels)
      .where(and(eq(labels.id, id), eq(labels.applicantId, applicantRecord.id)))
      .limit(1),
    db
      .select()
      .from(applicationData)
      .where(eq(applicationData.labelId, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  if (!label) notFound()

  // Compute effective status
  const effectiveStatus = getEffectiveStatus({
    status: label.status,
    correctionDeadline: label.correctionDeadline,
    deadlineExpired: label.deadlineExpired,
  })

  const brandName = appData?.brandName ?? 'Untitled Label'
  const isProcessing =
    label.status === 'pending' || label.status === 'processing'

  return (
    <PageShell className="space-y-6">
      {/* Auto-refresh while processing so the page updates when analysis completes */}
      {isProcessing && <AutoRefresh intervalMs={5_000} />}

      {/* Back link + header + timeline */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          asChild
        >
          <Link href={routes.submissions()}>
            <ArrowLeft className="size-4" />
            Back to My Submissions
          </Link>
        </Button>

        <PageHeader
          title={brandName}
          description={[
            appData?.serialNumber
              ? `Serial Number: ${appData.serialNumber}`
              : null,
            `Submitted ${timeAgo(label.createdAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <StatusBadge status={effectiveStatus} className="px-3 py-1 text-sm" />
        </PageHeader>

        {/* Horizontal timeline — streams independently */}
        <Suspense fallback={<TimelineSkeleton />}>
          <SubmissionTimelineSection
            labelId={label.id}
            label={label}
            appData={appData}
            applicantRecord={applicantRecord}
            effectiveStatus={effectiveStatus}
          />
        </Suspense>

        <div className="border-b" />
      </div>

      {/* Content area — streams independently */}
      <Suspense fallback={<ContentSkeleton />}>
        <SubmissionContentSection
          labelId={label.id}
          label={label}
          appData={appData}
          isProcessing={isProcessing}
        />
      </Suspense>
    </PageShell>
  )
}
