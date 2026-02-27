import { ExternalLink } from 'lucide-react'

const GITHUB_URL = 'https://github.com/ryparker/excisely'

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/40 px-4 py-4 md:px-8">
      <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
        <p>
          Excisely &mdash; Internal use only. Authorized TTB personnel and
          registered applicants.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          Source on GitHub
          <ExternalLink className="size-3" />
        </a>
      </div>
    </footer>
  )
}
