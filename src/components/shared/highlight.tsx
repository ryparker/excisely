/** Highlights all case-insensitive occurrences of `query` within `text`. */
export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>

  // Escape regex special chars, then split on the query (case-insensitive, keep delimiter)
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  if (parts.length === 1) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200/80 px-0.5 text-yellow-900 dark:bg-yellow-800/40 dark:text-yellow-200"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
