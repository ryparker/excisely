/**
 * Logs an action error and returns a standardized failure result.
 * Replaces the 4-line try/catch pattern used across server actions.
 */
export function logActionError(
  actionName: string,
  error: unknown,
  userMessage = 'An unexpected error occurred',
): { success: false; error: string } {
  console.error(`[${actionName}] Error:`, error)
  return { success: false, error: userMessage }
}
