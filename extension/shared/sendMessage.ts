/**
 * sendMessage.ts — Resilient chrome.runtime.sendMessage wrapper.
 *
 * Chrome MV3 service workers are terminated after ~5 minutes of inactivity.
 * When a content script sends a message to a terminated service worker it gets
 * "Could not establish connection. Receiving end does not exist."
 *
 * Chrome WILL restart the service worker when it receives the message, but
 * there is a race window where the first attempt fails while the worker starts
 * up.  A simple retry loop catches this race.
 *
 * Retry policy: up to 3 attempts with 300 ms → 600 ms → 900 ms back-off.
 * Total worst-case wait: ~1.8 s (user sees spinner during this time).
 */

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

function isSwTerminatedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Receiving end does not exist") ||
    msg.includes("Could not establish connection") ||
    msg.includes("The message port closed before a response was received")
  );
}

/**
 * Sends a message to the background service worker, retrying automatically
 * when the worker is mid-restart (MV3 termination race).
 *
 * @param message  Any serialisable message object.
 * @param retries  Maximum number of attempts (default: 3).
 * @returns        The response value, or `undefined` on final failure.
 */
export async function sendMessage<T>(
  message: object,
  retries: number = MAX_RETRIES,
): Promise<T | undefined> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // chrome.runtime.sendMessage itself triggers service worker restart,
      // but the CURRENT call may fail if the worker hasn't registered its
      // listener yet. The next attempt will succeed once it is ready.
      return await chrome.runtime.sendMessage(message) as T;
    } catch (err) {
      const isLast = attempt === retries;
      if (!isSwTerminatedError(err) || isLast) throw err;
      // Wait linearly before retrying: 300 ms, 600 ms, 900 ms…
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY_MS * attempt));
    }
  }
}
