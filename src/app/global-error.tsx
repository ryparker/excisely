'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background font-sans text-foreground antialiased">
        <div className="w-full max-w-md space-y-4 rounded-xl border p-8 text-center shadow-sm">
          <h1 className="font-heading text-2xl font-semibold">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
