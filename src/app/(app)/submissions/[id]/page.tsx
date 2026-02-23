import { eq, and } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Cpu,
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
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
import { getSession } from '@/lib/auth/get-session'
import { getEffectiveStatus } from '@/lib/labels/effective-status'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FieldLabel } from '@/components/shared/field-label'
import { ProcessingPipelineCard } from '@/components/validation/processing-pipeline-card'

export const dynamic = 'force-dynamic'

const BEVERAGE_TYPE_LABELS: Record<string, string> = {
  distilled_spirits: 'Distilled Spirits',
  wine: 'Wine',
  malt_beverage: 'Malt Beverage',
}

const STATUS_LABELS: Record<string, string> = {
  match: 'Match',
  mismatch: 'Mismatch',
  not_found: 'Not Found',
  needs_correction: 'Needs Correction',
}

const FIELD_LABELS: Record<string, string> = {
  brand_name: 'Brand Name',
  fanciful_name: 'Fanciful Name',
  class_type: 'Class/Type',
  alcohol_content: 'Alcohol Content',
  net_contents: 'Net Contents',
  health_warning: 'Health Warning',
  name_and_address: 'Name & Address',
  qualifying_phrase: 'Qualifying Phrase',
  country_of_origin: 'Country of Origin',
  grape_varietal: 'Grape Varietal',
  appellation_of_origin: 'Appellation of Origin',
  vintage_year: 'Vintage Year',
  sulfite_declaration: 'Sulfite Declaration',
  age_statement: 'Age Statement',
  state_of_distillation: 'State of Distillation',
  standards_of_fill: 'Standards of Fill',
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

interface SubmissionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  if (session.user.role !== 'applicant') {
    redirect('/')
  }

  const { id } = await params

  // Find applicant record by email
  const [applicantRecord] = await db
    .select({ id: applicants.id })
    .from(applicants)
    .where(eq(applicants.contactEmail, session.user.email))
    .limit(1)

  if (!applicantRecord) notFound()

  // Fetch label with authorization check
  const [label] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, id), eq(labels.applicantId, applicantRecord.id)))
    .limit(1)

  if (!label) notFound()

  // Fetch related data in parallel
  const [appData, images, results] = await Promise.all([
    db
      .select()
      .from(applicationData)
      .where(eq(applicationData.labelId, id))
      .limit(1),
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
      .limit(1),
  ])

  const app = appData[0]
  const currentResult = results[0]

  // Fetch validation items if result exists
  let items: Array<typeof validationItems.$inferSelect> = []
  if (currentResult) {
    items = await db
      .select()
      .from(validationItems)
      .where(eq(validationItems.validationResultId, currentResult.id))
  }

  const effectiveStatus = getEffectiveStatus({
    status: label.status,
    correctionDeadline: label.correctionDeadline,
    deadlineExpired: label.deadlineExpired,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={app?.brandName ?? 'Submission Detail'}
        description={`Submitted ${formatDate(label.createdAt)}`}
      >
        <Button variant="outline" asChild>
          <Link href="/submissions">
            <ArrowLeft className="size-4" />
            Back to Submissions
          </Link>
        </Button>
      </PageHeader>

      {/* Status + Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={effectiveStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Beverage Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {BEVERAGE_TYPE_LABELS[label.beverageType] ?? label.beverageType}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono font-medium">
              {label.overallConfidence
                ? `${Math.round(Number(label.overallConfidence))}%`
                : '--'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Label Images */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Label Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageUrl}
                    alt={img.imageFilename}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="bg-muted/50 px-2 py-1.5">
                    <p className="truncate text-xs font-medium">
                      {img.imageFilename}
                    </p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {img.imageType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing state — show animated pipeline progress */}
      {label.status === 'processing' && (
        <ProcessingPipelineCard
          labelId={label.id}
          imageCount={images.length}
          imageNames={images.map((img) => img.imageFilename)}
        />
      )}

      {effectiveStatus === 'approved' && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-3 py-6">
            <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Your label has been approved.
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                All fields match the submitted application data. You will
                receive a confirmation email with the final results.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {effectiveStatus === 'pending_review' && (
        <Card
          className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950"
          role="status"
        >
          <CardContent className="flex items-start gap-3 py-6">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                Your submission is under review.
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                A labeling specialist will review your application. You should
                receive a response within 2 business days.
              </p>
              {label.aiProposedStatus && (
                <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
                  AI preliminary assessment:{' '}
                  {label.aiProposedStatus === 'rejected'
                    ? 'Some fields may need attention'
                    : label.aiProposedStatus === 'needs_correction'
                      ? 'Minor corrections may be required'
                      : 'Pending specialist confirmation'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(effectiveStatus === 'rejected' ||
        effectiveStatus === 'needs_correction' ||
        effectiveStatus === 'conditionally_approved') && (
        <Card
          className={cn(
            'border',
            effectiveStatus === 'rejected'
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
          )}
        >
          <CardContent className="flex items-start gap-3 py-6">
            {effectiveStatus === 'rejected' ? (
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p
                className={cn(
                  'text-sm font-medium',
                  effectiveStatus === 'rejected'
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-amber-800 dark:text-amber-200',
                )}
              >
                {effectiveStatus === 'rejected'
                  ? 'Your label has been rejected.'
                  : effectiveStatus === 'needs_correction'
                    ? 'Your label needs correction.'
                    : 'Your label has been conditionally approved.'}
              </p>
              <p
                className={cn(
                  'text-sm',
                  effectiveStatus === 'rejected'
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300',
                )}
              >
                {effectiveStatus === 'rejected'
                  ? 'Please review the flagged fields below and submit a corrected application.'
                  : 'Please review the flagged fields below and submit corrections within the deadline.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Verification Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <FieldLabel
                      fieldName={item.fieldName}
                      className="text-sm font-medium"
                    >
                      {FIELD_LABELS[item.fieldName] ?? item.fieldName}
                    </FieldLabel>
                    <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium">Expected:</span>{' '}
                        <span className="font-mono">
                          {item.expectedValue || '—'}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Found:</span>{' '}
                        <span className="font-mono">
                          {item.extractedValue || '—'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === 'match'
                        ? 'default'
                        : item.status === 'needs_correction'
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="shrink-0"
                  >
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Pipeline Metrics */}
      {currentResult && (
        <PipelineMetricsCard
          processingTimeMs={currentResult.processingTimeMs}
          modelUsed={currentResult.modelUsed}
          aiRawResponse={currentResult.aiRawResponse}
        />
      )}

      {/* Application Data */}
      {app && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Application Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {app.serialNumber && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Serial Number
                  </dt>
                  <dd className="font-mono text-sm">{app.serialNumber}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  <FieldLabel fieldName="brand_name">Brand Name</FieldLabel>
                </dt>
                <dd className="text-sm">{app.brandName}</dd>
              </div>
              {app.fancifulName && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="fanciful_name">
                      Fanciful Name
                    </FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.fancifulName}</dd>
                </div>
              )}
              {app.classType && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="class_type">Class/Type</FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.classType}</dd>
                </div>
              )}
              {app.alcoholContent && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="alcohol_content">
                      Alcohol Content
                    </FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.alcoholContent}</dd>
                </div>
              )}
              {app.netContents && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="net_contents">
                      Net Contents
                    </FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.netContents}</dd>
                </div>
              )}
              {app.nameAndAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="name_and_address">
                      Name & Address
                    </FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.nameAndAddress}</dd>
                </div>
              )}
              {app.countryOfOrigin && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <FieldLabel fieldName="country_of_origin">
                      Country of Origin
                    </FieldLabel>
                  </dt>
                  <dd className="text-sm">{app.countryOfOrigin}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI Pipeline Metrics
// ---------------------------------------------------------------------------

interface PipelineMetrics {
  fetchTimeMs?: number
  ocrTimeMs?: number
  classificationTimeMs?: number
  mergeTimeMs?: number
  totalTimeMs?: number
  wordCount?: number
  imageCount?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

function PipelineMetricsCard({
  processingTimeMs,
  modelUsed,
  aiRawResponse,
}: {
  processingTimeMs: number
  modelUsed: string
  aiRawResponse: unknown
}) {
  // Extract metrics from raw response (stored by extract-label.ts)
  const raw = aiRawResponse as {
    metrics?: PipelineMetrics
    usage?: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
    }
  } | null
  const metrics = raw?.metrics
  const usage = raw?.usage

  const rows: Array<{ label: string; value: string }> = []

  if (metrics?.fetchTimeMs != null) {
    rows.push({ label: 'Blob Fetch', value: `${metrics.fetchTimeMs}ms` })
  }
  if (metrics?.ocrTimeMs != null) {
    rows.push({ label: 'OCR (Cloud Vision)', value: `${metrics.ocrTimeMs}ms` })
  }
  if (metrics?.classificationTimeMs != null) {
    rows.push({
      label: `Classification (${modelUsed})`,
      value: `${metrics.classificationTimeMs}ms`,
    })
  }
  if (metrics?.mergeTimeMs != null) {
    rows.push({ label: 'Bbox Merge', value: `${metrics.mergeTimeMs}ms` })
  }
  rows.push({ label: 'Total Pipeline', value: `${processingTimeMs}ms` })

  if (metrics?.wordCount != null) {
    rows.push({ label: 'OCR Words', value: String(metrics.wordCount) })
  }
  if (metrics?.imageCount != null) {
    rows.push({ label: 'Images Processed', value: String(metrics.imageCount) })
  }

  const inputTokens = metrics?.inputTokens ?? usage?.inputTokens
  const outputTokens = metrics?.outputTokens ?? usage?.outputTokens
  const totalTokens = metrics?.totalTokens ?? usage?.totalTokens

  if (inputTokens != null) {
    rows.push({ label: 'Input Tokens', value: inputTokens.toLocaleString() })
  }
  if (outputTokens != null) {
    rows.push({ label: 'Output Tokens', value: outputTokens.toLocaleString() })
  }
  if (totalTokens != null) {
    rows.push({ label: 'Total Tokens', value: totalTokens.toLocaleString() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Cpu className="size-4 text-muted-foreground" />
          AI Pipeline Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-medium text-muted-foreground">
                {row.label}
              </dt>
              <dd className="font-mono text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
