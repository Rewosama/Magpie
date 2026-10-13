/**
 * action-result.ts
 * Consistent discriminated union for all server action return values.
 *   { ok: true;  data: T }          — success
 *   { ok: false; error: string }     — validation error, auth failure, or DB error
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Construct a success result. */
export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Construct a failure result. */
export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
