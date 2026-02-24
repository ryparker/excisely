import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { and, eq, sql, count } from 'drizzle-orm'
import { ArrowRight, Flag, AlertTriangle, ShieldAlert } from 'lucide-react'

import { db } from '@/db'
import { humanReviews, validationItems, users } from '@/db/schema'
import { requireSpecialist } from '@/lib/auth/require-role'
import { FIELD_DISPLAY_NAMES } from '@/config/field-display-names'
import { PageHeader } from '@/components/layout/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { confidenceColor } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'AI Errors',
}

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  match: {
    label: 'Match',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  mismatch: {
    label: 'Mismatch',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  not_found: {
    label: 'Not Found',
    className: 'bg-secondary text-muted-foreground',
  },
  needs_correction: {
    label: 'Needs Correction',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

const FIELD_NAMES = [
  'brand_name',
  'fanciful_name',
  'class_type',
  'alcohol_content',
  'net_contents',
  'health_warning',
  'name_and_address',
  'qualifying_phrase',
  'country_of_origin',
  'grape_varietal',
  'appellation_of_origin',
  'vintage_year',
  'sulfite_declaration',
  'age_statement',
  'state_of_distillation',
  'standards_of_fill',
] as const

const ERROR_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'missed', label: 'Missed Errors' },
  { value: 'over_flagged', label: 'Over-Flagged' },
] as const

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

function buildUrl(
  current: Record<string, string | undefined>,
  overrides: Record<string, string>,
) {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries({ ...current, ...overrides })) {
    if (val && val !== '' && !(key === 'page' && val === '1')) {
      params.set(key, val)
    }
  }
  const qs = params.toString()
  return `/ai-errors${qs ? `?${qs}` : ''}`
}

// ---------------------------------------------------------------------------
// Filter component (server-component-compatible with link-based navigation)
// ---------------------------------------------------------------------------

function AIErrorFilters({
  fieldFilter,
  typeFilter,
}: {
  fieldFilter: string
  typeFilter: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Error type pills */}
      <div className="flex items-center gap-1">
        {ERROR_TYPES.map((t) => (
          <Button
            key={t.value}
            variant={typeFilter === t.value ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            asChild
          >
            <Link
              href={buildUrl(
                { field: fieldFilter || undefined },
                t.value === 'all' ? {} : { type: t.value },
              )}
            >
              {t.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Field filter pills */}
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant={!fieldFilter ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-[11px]"
          asChild
        >
          <Link
            href={buildUrl(
              { type: typeFilter !== 'all' ? typeFilter : undefined },
              {},
            )}
          >
            All Fields
          </Link>
        </Button>
        {FIELD_NAMES.map((name) => (
          <Button
            key={name}
            variant={fieldFilter === name ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-[11px]"
            asChild
          >
            <Link
              href={buildUrl(
                { type: typeFilter !== 'all' ? typeFilter : undefined },
                { field: name },
              )}
            >
              {FIELD_DISPLAY_NAMES[name] ?? name}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function AIErrorStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}
    </div>
  )
}

function AIErrorTableSkeleton() {
  return (
    <>
      {/* Filters skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>

      <Card className="py-0">
        {/* Table header */}
        <div className="border-b px-6 py-3">
          <div className="grid grid-cols-7 gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-7 items-center gap-4 px-6 py-3"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="ml-auto h-8 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Async section: Stats cards + total badge
// ---------------------------------------------------------------------------

async function AIErrorStats() {
  const [statsResult] = await db
    .select({
      totalErrors: count(),
      missedErrors: sql<number>`count(case when ${humanReviews.originalStatus} = 'match' and ${humanReviews.resolvedStatus} != 'match' then 1 end)`,
      overFlagged: sql<number>`count(case when ${humanReviews.originalStatus} != 'match' and ${humanReviews.resolvedStatus} = 'match' then 1 end)`,
    })
    .from(humanReviews)
    .where(
      sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`,
    )

  const stats = {
    totalErrors: statsResult?.totalErrors ?? 0,
    missedErrors: statsResult?.missedErrors ?? 0,
    overFlagged: statsResult?.overFlagged ?? 0,
  }

  return (
    <>
      <div className="flex items-center">
        <Badge variant="secondary" className="text-sm">
          {stats.totalErrors} total
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total AI Errors</p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
            {stats.totalErrors}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-muted-foreground">Missed Errors</p>
          </div>
          <p className="mt-1 font-heading text-2xl font-bold text-amber-700 tabular-nums dark:text-amber-400">
            {stats.missedErrors}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            AI said match, specialist disagreed
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-muted-foreground">Over-Flagged</p>
          </div>
          <p className="mt-1 font-heading text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
            {stats.overFlagged}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            AI flagged, specialist confirmed match
          </p>
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Async section: Filters + table + pagination
// ---------------------------------------------------------------------------

async function AIErrorTableSection({
  fieldFilter,
  typeFilter,
  currentPage,
}: {
  fieldFilter: string
  typeFilter: string
  currentPage: number
}) {
  // Cast to text because originalStatus (validation_item_status) and
  // resolvedStatus (resolved_status) are different PostgreSQL enums.
  const statusMismatch = sql`${humanReviews.originalStatus}::text != ${humanReviews.resolvedStatus}::text`
  const conditions = [statusMismatch]

  if (
    fieldFilter &&
    FIELD_NAMES.includes(fieldFilter as (typeof FIELD_NAMES)[number])
  ) {
    conditions.push(
      eq(
        validationItems.fieldName,
        fieldFilter as (typeof FIELD_NAMES)[number],
      ),
    )
  }

  if (typeFilter === 'missed') {
    conditions.push(eq(humanReviews.originalStatus, 'match'))
  } else if (typeFilter === 'over_flagged') {
    conditions.push(sql`${humanReviews.originalStatus}::text != 'match'`)
    conditions.push(eq(humanReviews.resolvedStatus, 'match'))
  }

  const offset = (currentPage - 1) * PAGE_SIZE

  const [totalQuery, rows] = await Promise.all([
    db
      .select({ count: count() })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .where(and(...conditions)),
    db
      .select({
        id: humanReviews.id,
        reviewedAt: humanReviews.reviewedAt,
        originalStatus: humanReviews.originalStatus,
        resolvedStatus: humanReviews.resolvedStatus,
        reviewerNotes: humanReviews.reviewerNotes,
        fieldName: validationItems.fieldName,
        confidence: validationItems.confidence,
        labelId: humanReviews.labelId,
        brandName: sql<string>`(
          SELECT ad.brand_name FROM application_data ad
          WHERE ad.label_id = ${humanReviews.labelId}
          LIMIT 1
        )`,
        specialistName: users.name,
      })
      .from(humanReviews)
      .innerJoin(
        validationItems,
        eq(humanReviews.validationItemId, validationItems.id),
      )
      .innerJoin(users, eq(humanReviews.specialistId, users.id))
      .where(and(...conditions))
      .orderBy(sql`${humanReviews.reviewedAt} desc`)
      .limit(PAGE_SIZE)
      .offset(offset),
  ])

  const totalCount = totalQuery[0]?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const params = {
    field: fieldFilter || undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  }

  return (
    <>
      <AIErrorFilters fieldFilter={fieldFilter} typeFilter={typeFilter} />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Flag className="mb-4 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {fieldFilter || typeFilter !== 'all'
                ? 'No AI errors match the current filters.'
                : 'No AI errors found. When specialists override AI classifications during review, they will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>AI Said</TableHead>
                  <TableHead>Specialist Said</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const aiStatus = STATUS_BADGE[row.originalStatus] ?? {
                    label: row.originalStatus,
                    className: 'bg-secondary text-muted-foreground',
                  }
                  const specStatus = STATUS_BADGE[row.resolvedStatus] ?? {
                    label: row.resolvedStatus,
                    className: 'bg-secondary text-muted-foreground',
                  }

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDate(new Date(row.reviewedAt))}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {row.brandName || 'Unknown'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {FIELD_DISPLAY_NAMES[row.fieldName] ?? row.fieldName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={aiStatus.className}
                          variant="secondary"
                        >
                          {aiStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={specStatus.className}
                          variant="secondary"
                        >
                          {specStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm tabular-nums ${confidenceColor(row.confidence ? Number(row.confidence) * 100 : null)}`}
                      >
                        {row.confidence
                          ? `${Math.round(Number(row.confidence) * 100)}%`
                          : '--'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {row.reviewerNotes || '--'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/labels/${row.labelId}`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View
                          <ArrowRight className="size-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)}{' '}
                of {totalCount}
              </p>
              <div className="flex gap-1">
                {currentPage > 1 && (
                  <Link
                    href={buildUrl(params, {
                      page: String(currentPage - 1),
                    })}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Previous
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={buildUrl(params, {
                      page: String(currentPage + 1),
                    })}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface AIErrorsPageProps {
  searchParams: Promise<{
    field?: string
    type?: string
    page?: string
  }>
}

export default async function AIErrorsPage({
  searchParams,
}: AIErrorsPageProps) {
  await requireSpecialist()

  const params = await searchParams
  const fieldFilter = params.field ?? ''
  const typeFilter = params.type ?? 'all'
  const currentPage = Math.max(1, Number(params.page) || 1)

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="AI Errors"
        description="Fields where specialist review disagreed with AI classification."
      />
      <Suspense fallback={<AIErrorStatsSkeleton />}>
        <AIErrorStats />
      </Suspense>
      <Suspense fallback={<AIErrorTableSkeleton />}>
        <AIErrorTableSection
          fieldFilter={fieldFilter}
          typeFilter={typeFilter}
          currentPage={currentPage}
        />
      </Suspense>
    </PageShell>
  )
}
