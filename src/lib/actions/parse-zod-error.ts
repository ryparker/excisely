import type { ZodError } from 'zod'

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Validation failed'
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}
