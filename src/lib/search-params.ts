interface PageSearchParams {
  currentPage: number
  searchTerm: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
}

export function parsePageSearchParams(params: {
  page?: string
  search?: string
  sort?: string
  order?: string
}): PageSearchParams {
  return {
    currentPage: Math.max(1, Number(params.page) || 1),
    searchTerm: params.search?.trim() ?? '',
    sortKey: params.sort ?? '',
    sortOrder: params.order === 'asc' ? 'asc' : 'desc',
  }
}
