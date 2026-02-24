'use client'

import { useTransition } from 'react'
import { useQueryState } from 'nuqs'

import { searchParamParsers } from '@/lib/search-params'

/** Shared pagination state backed by the `page` URL search param. */
export function usePaginationState() {
  const [, startTransition] = useTransition()
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    searchParamParsers.page.withOptions({ shallow: false, startTransition }),
  )

  return {
    currentPage,
    onPrevious: () =>
      setCurrentPage(currentPage - 1 > 1 ? currentPage - 1 : null),
    onNext: () => setCurrentPage(currentPage + 1),
  }
}
