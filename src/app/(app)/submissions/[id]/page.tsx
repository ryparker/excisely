import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, and } from 'drizzle-orm'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SearchX,
  ArrowRight,
} from 'lucide-react'

import { db } from '@/db'
import {
  labels,
  applicationData,
  labelImages,
  validationResults,
  validationItems,
  applicants,
} from '@/db/schema'
import { requireApplicant } from '@/lib/auth/require-role'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { getSignedImageUrl } from '@/lib/storage/blob'
import { buildApplicantTimeline } from '@/lib/timeline/build-timeline'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { StatusExplainer } from '@/components/shared/status-explainer'
import { AutoRefresh } from '@/components/shared/auto-refresh'
import { ValidationDetailPanels } from '@/components/validation/validation-detail-panels'
import { ProcessingStatusBanner } from '@/components/validation/processing-status-banner'
import { ProcessingDetailPanels } from '@/components/validation/processing-detail-panels'
import { CorrespondenceTimeline } from '@/components/timeline/correspondence-timeline'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface SubmissionDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: SubmissionDetailPageProps) {
  const session = await requireApplicant()

  const { id } = await params
  const { confirmed } = await searchParams
  const showConfirmation = confirmed === 'true'

  // Find applicant record by email
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

  // Fetch label — ownership check via applicantId
  const [label] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, id), eq(labels.applicantId, applicantRecord.id)))
    .limit(1)

  if (!label) notFound()

  // Fetch related data in parallel — NO human reviews or status overrides
  const [appData, images, results] = await Promise.all([
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

  // Fetch validation items
  const items = results
    ? await db
        .select()
        .from(validationItems)
        .where(eq(validationItems.validationResultId, results.id))
    : []

  // Compute effective status
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
  const signedImages = images.map((img) => ({
    id: img.id,
    imageUrl: getSignedImageUrl(img.imageUrl),
    imageType: img.imageType,
    sortOrder: img.sortOrder,
  }))

  // Strip confidence and reasoning from mapped items
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

  const isProcessing =
    label.status === 'pending' || label.status === 'processing'

  return (
    <PageShell className="space-y-5">
      {/* Auto-refresh while processing so the page updates when analysis completes */}
      {isProcessing && <AutoRefresh intervalMs={5_000} />}

      {/* Back link + header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          asChild
        >
          <Link href="/submissions">
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
          <StatusExplainer
            status={effectiveStatus}
            role="applicant"
            className="px-3 py-1 text-sm"
          />
        </PageHeader>
      </div>

      {/* Confirmation banner — only shown immediately after submission */}
      {showConfirmation && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Submission received &mdash; No immediate validation errors were
            detected. Your application is now in the review queue.
          </p>
        </div>
      )}

      {isProcessing ? (
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
      ) : (
        <>
          {/* Combined status + guidance card */}
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <div className="space-y-3">
              {/* Field counts */}
              <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle2 className="size-3.5" />
                  {fieldCounts.match}
                </span>
                {fieldCounts.mismatch > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    <XCircle className="size-3.5" />
                    {fieldCounts.mismatch}
                  </span>
                )}
                {fieldCounts.needsCorrection > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" />
                    {fieldCounts.needsCorrection}
                  </span>
                )}
                {fieldCounts.notFound > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">
                    <SearchX className="size-3.5" />
                    {fieldCounts.notFound}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  of{' '}
                  {fieldCounts.match +
                    fieldCounts.mismatch +
                    fieldCounts.notFound +
                    fieldCounts.needsCorrection}{' '}
                  automated checks complete
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* What's Next guidance */}
              <div className="flex items-start gap-2.5">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  {effectiveStatus === 'pending_review' && (
                    <p>
                      <span className="font-medium text-foreground">
                        What&apos;s next:
                      </span>{' '}
                      A labeling specialist will review the AI analysis and your
                      application. You should hear back within 3 business days.
                      Keep an eye on this page for updates.
                    </p>
                  )}
                  {effectiveStatus === 'approved' && (
                    <p>
                      <span className="font-medium text-foreground">
                        Your label is approved.
                      </span>{' '}
                      You may proceed with printing and distribution. No further
                      action is needed.
                    </p>
                  )}
                  {effectiveStatus === 'conditionally_approved' && (
                    <p>
                      <span className="font-medium text-foreground">
                        Corrections requested:
                      </span>{' '}
                      Your label has been conditionally approved. Please review
                      the flagged fields below and submit corrections within 7
                      days.
                    </p>
                  )}
                  {effectiveStatus === 'needs_correction' && (
                    <p>
                      <span className="font-medium text-foreground">
                        Corrections needed:
                      </span>{' '}
                      Some fields on your label need attention. Review the
                      flagged items below and resubmit corrections within 30
                      days.
                    </p>
                  )}
                  {effectiveStatus === 'rejected' && (
                    <p>
                      <span className="font-medium text-foreground">
                        Application not approved.
                      </span>{' '}
                      Please review the notes below. You may submit a revised
                      application.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Two-panel layout: image + field list with hideInternals */}
          {signedImages.length > 0 && items.length > 0 ? (
            <ValidationDetailPanels
              images={signedImages}
              validationItems={mappedItems}
              hideInternals
            />
          ) : (
            <div className="flex items-center justify-center rounded-lg border py-24 text-sm text-muted-foreground">
              No verification data available for this submission.
            </div>
          )}
        </>
      )}

      {/* Applicant-safe timeline */}
      <CorrespondenceTimeline
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
      />
    </PageShell>
  )
}
