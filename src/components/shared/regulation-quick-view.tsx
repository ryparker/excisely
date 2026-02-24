'use client'

import { ExternalLink, Scale } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatFieldName } from '@/config/field-display-names'

const PART_LABEL: Record<number, string> = {
  4: 'Wine',
  5: 'Spirits',
  7: 'Malt Beverage',
  16: 'Health Warning',
}

interface RegulationQuickViewProps {
  /** Full citation, e.g. "27 CFR 5.63" */
  citation: string
  /** Section title */
  title: string
  /** Plain-English summary */
  summary: string
  /** Key requirements */
  keyRequirements: string[]
  /** Related field keys */
  relatedFields: string[]
  /** Deep link to eCFR */
  ecfrUrl: string
  /** CFR Part (4, 5, 7, 16) for part-level context in footer link */
  contextPart?: number
  /** Field key (e.g. 'brand_name') for field-level context in footer link */
  contextField?: string
}

export function RegulationQuickView({
  citation,
  title,
  summary,
  keyRequirements,
  relatedFields,
  ecfrUrl,
  contextPart,
  contextField,
}: RegulationQuickViewProps) {
  const { href: footerHref, label: footerLabel } = getFooterLink(
    contextPart,
    contextField,
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {citation}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
              {citation}
            </span>
          </div>
          <DialogTitle className="font-heading text-base">{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        {/* Key requirements */}
        {keyRequirements.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground/70">
              Key requirements
            </p>
            <ul className="space-y-1.5">
              {keyRequirements.map((req, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/30" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Related fields */}
        {relatedFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground/50 uppercase">
              Related fields
            </span>
            {relatedFields.map((field) => (
              <Badge
                key={field}
                variant="outline"
                className="px-1.5 py-0 text-[10px] font-normal"
              >
                {formatFieldName(field)}
              </Badge>
            ))}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <a
            href={footerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Scale className="size-3" />
            {footerLabel}
          </a>
          <a
            href={ecfrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Full text on eCFR
            <ExternalLink className="size-3" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Simpler variant for inline use in FieldComparisonRow.
 * Shows as a text link that opens the same dialog.
 */
export function RegulationInlineLink({
  citation,
  title,
  summary,
  keyRequirements,
  relatedFields,
  ecfrUrl,
  contextPart,
  contextField,
}: RegulationQuickViewProps) {
  const { href: footerHref, label: footerLabel } = getFooterLink(
    contextPart,
    contextField,
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Scale className="size-3" />
          <span>See regulation ({citation})</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
              {citation}
            </span>
          </div>
          <DialogTitle className="font-heading text-base">{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        {keyRequirements.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground/70">
              Key requirements
            </p>
            <ul className="space-y-1.5">
              {keyRequirements.map((req, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/30" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {relatedFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground/50 uppercase">
              Related fields
            </span>
            {relatedFields.map((field) => (
              <Badge
                key={field}
                variant="outline"
                className="px-1.5 py-0 text-[10px] font-normal"
              >
                {formatFieldName(field)}
              </Badge>
            ))}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <a
            href={footerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Scale className="size-3" />
            {footerLabel}
          </a>
          <a
            href={ecfrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Full text on eCFR
            <ExternalLink className="size-3" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getFooterLink(contextPart?: number, contextField?: string) {
  if (contextField) {
    const fieldName = formatFieldName(contextField)
    return {
      href: `/regulations?field=${contextField}`,
      label: `All ${fieldName} regulations`,
    }
  }
  if (contextPart && PART_LABEL[contextPart]) {
    return {
      href: `/regulations?part=${contextPart}`,
      label: `All ${PART_LABEL[contextPart]} regulations`,
    }
  }
  return { href: '/regulations', label: 'All regulations' }
}
