'use client'

import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useQueryState, parseAsString } from 'nuqs'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  /** URL search param key (default: "search") */
  paramKey?: string
  placeholder?: string
  className?: string
}

/**
 * Debounced search input that auto-navigates on type.
 * Reads initial value from URL params via nuqs; updates the URL after 300ms idle.
 * Enter submits immediately; X button clears and refocuses.
 */
export function SearchInput({
  paramKey = 'search',
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  const [, setPage] = useQueryState('page', parseAsString)
  const [search, setSearch] = useQueryState(
    paramKey,
    parseAsString.withDefault('').withOptions({ shallow: false }),
  )

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasValue, setHasValue] = useState(() => search.length > 0)

  function navigate(term: string) {
    const trimmed = term.trim()
    void setPage(null) // Reset pagination on search change
    void setSearch(trimmed || null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHasValue(e.target.value.length > 0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(e.target.value), 300)
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = ''
    setHasValue(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    navigate('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      navigate((e.target as HTMLInputElement).value)
    }
  }

  // Key the input on the URL param value so that external changes (back/forward,
  // filter clicks) reset the uncontrolled input without needing setState in an effect.
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        key={search}
        ref={inputRef}
        type="search"
        defaultValue={search}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pr-8 pl-9"
        spellCheck={false}
        autoComplete="off"
        data-1p-ignore
      />
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="ease absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
