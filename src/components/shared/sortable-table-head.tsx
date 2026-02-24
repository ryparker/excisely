'use client'

import { useTransition } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useQueryState, parseAsString } from 'nuqs'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface SortableTableHeadProps {
  /** The sort key this column maps to (e.g. "brandName", "createdAt") */
  sortKey: string
  children: React.ReactNode
  className?: string
}

export function SortableTableHead({
  sortKey,
  children,
  className,
}: SortableTableHeadProps) {
  const [, startTransition] = useTransition()
  const [, setPage] = useQueryState('page', parseAsString)
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsString
      .withDefault('')
      .withOptions({ shallow: false, startTransition }),
  )
  const [order, setOrder] = useQueryState(
    'order',
    parseAsString
      .withDefault('')
      .withOptions({ shallow: false, startTransition }),
  )

  const isActive = sort === sortKey
  const currentOrder = isActive ? order : null

  function handleClick() {
    void setPage(null)
    if (!isActive) {
      // Activate with ascending
      void setSort(sortKey)
      void setOrder('asc')
    } else if (currentOrder === 'asc') {
      // Switch to descending
      void setOrder('desc')
    } else {
      // Clear sort
      void setSort(null)
      void setOrder(null)
    }
  }

  const Icon =
    currentOrder === 'asc'
      ? ArrowUp
      : currentOrder === 'desc'
        ? ArrowDown
        : ArrowUpDown

  return (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={handleClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon
          className={cn(
            'size-3',
            isActive ? 'text-foreground' : 'text-muted-foreground/40',
          )}
        />
      </span>
    </TableHead>
  )
}
