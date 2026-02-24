import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Beer,
  ExternalLink,
  Martini,
  Scale,
  Search,
  ShieldAlert,
  Wine,
} from 'lucide-react'

import { routes } from '@/config/routes'

import { searchParamsCache } from '@/lib/search-params-cache'
import { ScrollToSection } from './ScrollToSection'
import { AnimatedCollapse } from '@/components/shared/AnimatedCollapse'
import { FilterBar } from '@/components/shared/FilterBar'
import { Highlight } from '@/components/shared/Highlight'
import { SearchInput } from '@/components/shared/SearchInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/Card'
import {
  BEVERAGE_BADGE_STYLE,
  BEVERAGE_ICON,
  BEVERAGE_LABEL,
} from '@/config/beverage-display'
import { formatFieldName } from '@/config/field-display-names'
import {
  ALL_SECTIONS,
  REGULATION_PARTS,
  type RegulationSection,
} from '@/config/regulations'
import { cn } from '@/lib/utils'

const PART_FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Spirits', value: '5' },
  { label: 'Wine', value: '4' },
  { label: 'Malt Beverages', value: '7' },
  { label: 'Health Warning', value: '16' },
]

const PART_ICON: Record<number, typeof Wine> = {
  5: Martini,
  4: Wine,
  7: Beer,
  16: ShieldAlert,
}

const PART_ICON_STYLE: Record<number, string> = {
  5: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  4: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
  7: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400',
  16: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
}

export const metadata: Metadata = {
  title: 'Regulations Reference',
}

interface RegulationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RegulationsPage({
  searchParams,
}: RegulationsPageProps) {
  await searchParamsCache.parse(searchParams)
  const search = searchParamsCache.get('search')
  const part = searchParamsCache.get('part')
  const field = searchParamsCache.get('field')

  const activePart = part ? Number(part) : null
  const activeField = field || null
  const searchQuery = search?.toLowerCase().trim() ?? ''

  // Determine whether we're in a filtered view (search, part filter, or field filter)
  const isFiltered =
    activePart !== null || activeField !== null || searchQuery.length > 0

  // Filter sections
  let sections: RegulationSection[] = ALL_SECTIONS

  if (activePart) {
    sections = sections.filter((s) => s.part === activePart)
  }

  if (activeField) {
    sections = sections.filter((s) => s.relatedFields.includes(activeField))
  }

  if (searchQuery) {
    sections = sections.filter((s) => {
      const haystack = [
        s.citation,
        s.title,
        s.summary,
        s.subpart,
        ...s.keyRequirements,
        ...s.relatedFields.map((f) => formatFieldName(f)),
        ...s.appliesTo.map((t) => BEVERAGE_LABEL[t] ?? t),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(searchQuery)
    })
  }

  // Group by part for display
  const groupedByPart = REGULATION_PARTS.map((p) => ({
    ...p,
    sections: sections.filter((s) => s.part === p.part),
  })).filter((p) => p.sections.length > 0)

  const fieldDisplayName = activeField ? formatFieldName(activeField) : null

  return (
    <PageShell className="space-y-6">
      <ScrollToSection />
      <PageHeader
        title="Regulations Reference"
        description="27 CFR labeling requirements for alcohol beverages"
      />

      {/* Search and tab filter bar — always in the same position to prevent layout shift */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          paramKey="search"
          placeholder="Search regulations..."
          className="w-full sm:flex-1"
        />
        <FilterBar paramKey="part" options={PART_FILTER_OPTIONS} />
      </div>

      {/* Overview section — collapses smoothly when any filter is active */}
      <AnimatedCollapse visible={!isFiltered}>
        <div className="space-y-4">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            TTB regulates alcohol labels under Title 27 of the Code of Federal
            Regulations. Each beverage type has its own set of rules governing
            what must appear on the label. Browse the summaries below or click
            through to the full legal text on eCFR.
          </p>

          {/* Part overview cards — quick nav + orientation */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REGULATION_PARTS.map((p) => {
              const Icon = PART_ICON[p.part]
              return (
                <Link
                  key={p.part}
                  href={`${routes.regulations()}?part=${p.part}`}
                  className="group"
                >
                  <Card className="h-full shadow-sm transition-shadow duration-150 ease-out group-hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="mb-2.5 flex items-center gap-3">
                        <span
                          className={cn(
                            'inline-flex size-9 items-center justify-center rounded-xl',
                            PART_ICON_STYLE[p.part],
                          )}
                        >
                          {Icon && <Icon className="size-[18px]" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold">{p.title}</h3>
                          <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                            Part {p.part} &middot; {p.sections.length} sections
                          </p>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {p.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </AnimatedCollapse>

      {/* Active field filter banner */}
      <AnimatedCollapse visible={!!fieldDisplayName}>
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <Scale className="size-4 text-primary" />
          <p className="text-sm text-foreground">
            Showing regulations for{' '}
            <span className="font-semibold">{fieldDisplayName}</span>
          </p>
          <Link
            href={routes.regulations()}
            className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear filter
          </Link>
        </div>
      </AnimatedCollapse>

      {/* Results count — only show when filtered */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          {sections.length} {sections.length === 1 ? 'section' : 'sections'}
          {searchQuery && ` matching "${search}"`}
        </p>
      )}

      {/* Section cards grouped by Part */}
      {groupedByPart.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent>
            <Search className="mx-auto mb-3 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No regulations found. Try a different search term.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {groupedByPart.map((partGroup) => {
            const PartIcon = PART_ICON[partGroup.part]
            return (
              <section key={partGroup.part}>
                {/* Part header */}
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'inline-flex size-8 items-center justify-center rounded-lg',
                        PART_ICON_STYLE[partGroup.part],
                      )}
                    >
                      {PartIcon && <PartIcon className="size-4" />}
                    </span>
                    <div>
                      <h2 className="font-heading text-base font-semibold tracking-tight sm:text-lg">
                        {partGroup.title}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        27 CFR Part {partGroup.part} &middot;{' '}
                        {partGroup.sections.length}{' '}
                        {partGroup.sections.length === 1
                          ? 'section'
                          : 'sections'}
                      </p>
                    </div>
                  </div>
                  <a
                    href={partGroup.ecfrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-primary"
                  >
                    Full text on eCFR
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="grid gap-3">
                  {partGroup.sections.map((section) => (
                    <SectionCard
                      key={section.section}
                      section={section}
                      query={searchQuery}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

function SectionCard({
  section,
  query,
}: {
  section: RegulationSection
  query: string
}) {
  const requirementsMatch =
    query.length > 0 &&
    section.keyRequirements.some((r) => r.toLowerCase().includes(query))

  return (
    <div
      id={section.section}
      className="regulation-card group/card scroll-mt-20 rounded-lg border bg-card p-4 shadow-sm transition-shadow duration-150 ease-out hover:shadow-md sm:p-5"
    >
      {/* Top row: citation + badges + eCFR link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
            <Highlight text={section.citation} query={query} />
          </span>
          {section.appliesTo.map((type) => {
            const Icon = BEVERAGE_ICON[type]
            return (
              <span
                key={type}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  BEVERAGE_BADGE_STYLE[type],
                )}
              >
                {Icon && <Icon className="size-2.5" />}
                {BEVERAGE_LABEL[type]}
              </span>
            )
          })}
        </div>
        <a
          href={section.ecfrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground/60 transition-colors duration-150 ease-out hover:text-primary"
        >
          eCFR
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Title + summary — tightly coupled */}
      <h3 className="mt-2 text-sm leading-snug font-semibold">
        <Highlight text={section.title} query={query} />
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        <Highlight text={section.summary} query={query} />
      </p>

      {/* Key requirements — auto-open when search matches inside */}
      <details className="group mt-3" open={requirementsMatch || undefined}>
        <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground/60 transition-colors duration-150 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">
            <svg
              className="size-3 shrink-0 transition-transform duration-150 group-open:rotate-90"
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M4.5 2l4 4-4 4V2z" />
            </svg>
            <span className="group-open:hidden">
              Show key requirements ({section.keyRequirements.length})
            </span>
            <span className="hidden group-open:inline">Key requirements</span>
          </span>
        </summary>
        <ul className="mt-2 space-y-1.5 pl-3.5">
          {section.keyRequirements.map((req, i) => (
            <li
              key={i}
              className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/25" />
              <Highlight text={req} query={query} />
            </li>
          ))}
        </ul>
      </details>

      {/* Related fields */}
      {section.relatedFields.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-dashed pt-2.5">
          {section.relatedFields.map((field) => (
            <span
              key={field}
              className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Highlight text={formatFieldName(field)} query={query} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
