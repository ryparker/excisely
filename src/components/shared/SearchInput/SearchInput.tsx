'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useQueryStates, parseAsString } from 'nuqs'

import { searchParamParsers } from '@/lib/search-params'

import { Input } from '@/components/ui/Input'
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
 *
 * Uses a controlled input with a draft state so the DOM element persists
 * across URL changes — no focus loss during typing.
 */
export function SearchInput({
  paramKey = 'search',
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  const [, startTransition] = useTransition()
  const [params, setParams] = useQueryStates(
    {
      page: searchParamParsers.page,
      [paramKey]: parseAsString.withDefault(''),
    },
    { shallow: false, startTransition },
  )
  const search = String(params[paramKey] ?? '')

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Draft holds the user's in-progress typing. When null, fall back to URL value.
  // This avoids effects and ref reads during render (React compiler safe).
  const [draft, setDraft] = useState<string | null>(null)
  const displayValue = draft ?? search

  function navigate(term: string) {
    const trimmed = term.trim()
    void setParams({ page: null, [paramKey]: trimmed || null })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(e.target.value), 300)
  }

  function handleClear() {
    setDraft(null)
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

  function handleBlur() {
    // Flush any pending debounce so the URL stays in sync
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Submit any un-flushed draft before clearing
    if (draft !== null && draft.trim() !== search) {
      navigate(draft)
    }
    setDraft(null)
  }

  const isSearching = draft !== null && draft.trim() !== search

  return (
    <div className={cn('relative', className)}>
      {isSearching ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pr-8 pl-9"
        spellCheck={false}
        autoComplete="off"
        data-1p-ignore
      />
      {displayValue.length > 0 && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="ease absolute top-1/2 right-0.5 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
