import { parseAsString, parseAsInteger } from 'nuqs/server'

/**
 * Single source of truth for all URL search param parsers.
 * Used by: createSearchParamsCache (server), useQueryState/useQueryStates (client)
 */
export const searchParamParsers = {
  page: parseAsInteger.withDefault(1),
  search: parseAsString.withDefault(''),
  sort: parseAsString.withDefault(''),
  order: parseAsString.withDefault('desc'),
  status: parseAsString.withDefault(''),
  beverageType: parseAsString.withDefault(''),
  queue: parseAsString.withDefault(''),
  risk: parseAsString.withDefault(''),
  field: parseAsString.withDefault(''),
  type: parseAsString.withDefault(''),
  part: parseAsString.withDefault(''),
}
