'use client'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

/**
 * Wraps the term "COLA" with a hover card explaining what it means.
 * Not all applicants are familiar with the acronym — use this whenever
 * "COLA" appears in the UI, or prefer plain language ("label application")
 * where the official term isn't necessary.
 */
export function ColaTooltip() {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <abbr
          className="cursor-help no-underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] hover:underline"
          title="Certificate of Label Approval"
        >
          COLA
        </abbr>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-sm" side="top">
        <p className="font-heading font-semibold">
          Certificate of Label Approval
        </p>
        <p className="mt-1 text-muted-foreground">
          The official TTB permit required before any alcohol beverage label can
          be sold in the United States. Issued after a label passes review
          against federal regulations.
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
