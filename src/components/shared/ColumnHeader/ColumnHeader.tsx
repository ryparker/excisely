'use client'

import { useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, ListFilter } from 'lucide-react'
import { useQueryStates, parseAsString } from 'nuqs'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { TableHead } from '@/components/ui/Table'
import { cn } from '@/lib/utils'

interface FilterOption {
  label: string
  value: string
}

interface ColumnHeaderProps {
  children: React.ReactNode
  /** Sort key for this column (enables sort asc/desc in dropdown) */
  sortKey?: string
  /** Default sort direction when no sort param is in the URL (e.g. "desc" for Submitted column) */
  defaultSort?: 'asc' | 'desc'
  /** URL param key for filter state (e.g. "status", "beverageType") */
  filterKey?: string
  /** Options for the filter radio group */
  filterOptions?: readonly FilterOption[]
  /** Tooltip description shown on hover to explain the column */
  description?: string
  className?: string
}

export function ColumnHeader({
  children,
  sortKey,
  defaultSort,
  filterKey,
  filterOptions,
  description,
  className,
}: ColumnHeaderProps) {
  const [isPending, startTransition] = useTransition()
  const [params, setParams] = useQueryStates(
    {
      page: parseAsString,
      sort: parseAsString.withDefault(''),
      order: parseAsString.withDefault(''),
      ...(filterKey ? { [filterKey]: parseAsString.withDefault('') } : {}),
    },
    { shallow: false, startTransition },
  )

  const sort = params.sort
  const order = params.order
  const filterValue = filterKey
    ? (Object.entries(params).find(([k]) => k === filterKey)?.[1] ?? '')
    : ''

  // This column is the active sort either explicitly (URL param) or implicitly (default when no sort in URL)
  const isExplicitSort = sortKey ? sort === sortKey : false
  const isDefaultSort = defaultSort && sortKey ? sort === '' : false
  const isSortActive = isExplicitSort || isDefaultSort
  const effectiveOrder = isExplicitSort
    ? order
    : isDefaultSort
      ? defaultSort
      : null
  const isFilterActive = filterKey ? filterValue !== '' : false
  const hasDropdown = !!sortKey || (!!filterKey && !!filterOptions)

  function handleSort(direction: 'asc' | 'desc') {
    if (isSortActive && effectiveOrder === direction) {
      // Clicking the already-active sort clears to default
      void setParams({ page: null, sort: null, order: null })
    } else {
      void setParams({ page: null, sort: sortKey!, order: direction })
    }
  }

  function handleFilter(value: string) {
    void setParams({ page: null, [filterKey!]: value || null })
  }

  if (!hasDropdown) {
    if (description) {
      return (
        <TableHead className={className}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default border-b border-dashed border-muted-foreground/30">
                  {children}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                {description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableHead>
      )
    }
    return <TableHead className={className}>{children}</TableHead>
  }

  const TriggerIcon = isFilterActive
    ? ListFilter
    : isSortActive
      ? effectiveOrder === 'asc'
        ? ArrowUp
        : ArrowDown
      : ChevronsUpDown

  return (
    <TableHead className={cn('p-0', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-full w-full cursor-pointer items-center gap-1 px-3 py-2 text-left text-[11px] font-medium tracking-wider whitespace-nowrap text-muted-foreground uppercase select-none hover:bg-muted/50 hover:text-foreground',
              className?.includes('text-right') && 'justify-end',
              isPending && 'opacity-70',
            )}
          >
            {children}
            <span className="relative ml-0.5 inline-flex items-center">
              <TriggerIcon
                className={cn(
                  'size-3',
                  isSortActive || isFilterActive
                    ? 'text-foreground'
                    : 'text-muted-foreground/40',
                )}
              />
              {isFilterActive && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
              )}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {description && (
            <>
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                {description}
              </p>
              <DropdownMenuSeparator />
            </>
          )}
          {sortKey && (
            <>
              <DropdownMenuItem onClick={() => handleSort('asc')}>
                <ArrowUp className="size-3.5" />
                Sort ascending
                {isSortActive && effectiveOrder === 'asc' && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('desc')}>
                <ArrowDown className="size-3.5" />
                Sort descending
                {isSortActive && effectiveOrder === 'desc' && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            </>
          )}
          {sortKey && filterKey && filterOptions && <DropdownMenuSeparator />}
          {filterKey && filterOptions && (
            <>
              <DropdownMenuLabel>Filter</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={filterValue}
                onValueChange={handleFilter}
              >
                {filterOptions.map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}
