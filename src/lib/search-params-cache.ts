import { createSearchParamsCache } from 'nuqs/server'

import { searchParamParsers } from './search-params'

export const searchParamsCache = createSearchParamsCache(searchParamParsers)
