'use client'

import * as React from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  emptyMessage?: string
  id?: string
  onFocus?: () => void
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Select...',
  emptyMessage = 'No results found.',
  id,
  onFocus,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [highlightIndex, setHighlightIndex] = React.useState(0)
  const listRef = React.useRef<HTMLUListElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const generatedId = React.useId()
  const listboxId = id ? `${id}-listbox` : `${generatedId}-listbox`

  const selectedLabel = options.find((o) => o.value === value)?.label

  const filtered = React.useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lower))
  }, [options, search])

  // Reset search and highlight when opening/closing
  React.useEffect(() => {
    if (open) {
      setSearch('')
      // Set highlight to current selection, or 0
      const idx = filtered.findIndex((o) => o.value === value)
      setHighlightIndex(idx >= 0 ? idx : 0)
      // Focus input after popover opens
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep highlight in bounds when filter changes
  React.useEffect(() => {
    setHighlightIndex((prev) =>
      Math.min(prev, Math.max(0, filtered.length - 1)),
    )
  }, [filtered.length])

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return
    const item = list.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  function select(optionValue: string) {
    onValueChange(optionValue)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIndex]) {
          select(filtered[highlightIndex].value)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          disabled={disabled}
          onFocus={onFocus}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col" onKeyDown={handleKeyDown}>
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setHighlightIndex(0)
            }}
            placeholder="Search..."
            className="h-9 border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-60 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, i) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  data-highlighted={i === highlightIndex || undefined}
                  className={cn(
                    'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none',
                    i === highlightIndex && 'bg-accent text-accent-foreground',
                  )}
                  onMouseMove={() => setHighlightIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault() // keep input focused
                    select(option.value)
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      <CheckIcon className="size-4" />
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  )
}
