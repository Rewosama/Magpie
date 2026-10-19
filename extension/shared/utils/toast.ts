/**
 * Content-script toast utilities — placeholder module.
 *
 * The full toast rendering (DOM injection, auto-dismiss, platform-adaptive
 * styling, "Change collection" shortcut) is implemented in task 12.1
 * (`content-scripts/toast.ts`). Until then, the functions here provide the
 * correct signatures so that callers can be wired up and the end-to-end
 * error-propagation path is exercisable.
 *
 * Requirements: 18.6
 */

/**
 * Notifies the user that they have hit the API rate limit and must wait
 * before retrying.
 *
 * Content scripts call this when `BackgroundResponse.code === "RATE_LIMITED"`.
 * The `waitSeconds` value comes from the BSW error message, which in turn
 * reads it from the `Retry-After` response header returned by the Edge
 * Function (Requirement 18.6).
 *
 * PLACEHOLDER — full toast UI arrives in task 12.1. For now, the message is
 * emitted as a console warning so the propagation path is end-to-end testable
 * without blocking on the UI layer.
 *
 * @param waitSeconds - Seconds to wait before retrying, as a string
 *   (e.g. "60"). Sourced from the Retry-After header via the BSW error
 *   message.
 *
 * Requirement 18.6
 */
export function sendRateLimitedToast(waitSeconds: string): void {
  // Full toast implementation provided in task 12.1.
  console.warn(
    `[Magpie] Too many requests. Please wait ${waitSeconds} seconds before trying again.`,
  );
}
