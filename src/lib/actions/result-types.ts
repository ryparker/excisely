/**
 * Generic discriminated union for server action results.
 *
 * Use for actions that return a payload on success:
 *   ActionResult<{ labelId: string }>
 *
 * Use for actions that return nothing on success:
 *   ActionResult
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ActionResult<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string }
