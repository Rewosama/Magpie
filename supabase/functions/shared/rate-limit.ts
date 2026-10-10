/**
 * Shared rate-limiting utility for Supabase Edge Functions.
 *
 * Uses a sliding-window counter backed by Deno KV.  Each key entry is stored
 * with a TTL equal to the window duration, so the counter automatically resets
 * once the window has fully elapsed with no new requests (Requirement 18.5).
 *
 * Atomic compare-and-swap with retries prevents lost updates when concurrent
 * requests arrive for the same key.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Length of the rate-limit window in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether this request is permitted. */
  allowed: boolean;
  /** Requests remaining in the current window (0 when not allowed). */
  remaining: number;
  /**
   * Seconds the caller must wait before the next request may succeed.
   * 0 when the request is allowed.
   */
  retryAfterSeconds: number;
}

// ── Core logic ───────────────────────────────────────────────────────────────

/**
 * Checks and updates the sliding-window rate-limit counter for a given key.
 *
 * @param key     Unique identifier for the rate-limit bucket (e.g. `"user:<uuid>:save-post"`).
 * @param config  Window size and maximum request count.
 * @returns       A {@link RateLimitResult} indicating whether the request is allowed.
 *
 * Implements Requirements 18.1, 18.2, 18.5.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  // If Deno KV is not available (e.g., not enabled in Supabase project),
  // fail open so requests are not blocked by missing infrastructure.
  let kv: Deno.Kv;
  try {
    kv = await Deno.openKv();
  } catch {
    return { allowed: true, remaining: config.maxRequests, retryAfterSeconds: 0 };
  }
  const kvKey: Deno.KvKey = ['rate_limit', key]
  const expireIn = config.windowSeconds * 1000 // Deno KV TTL is in milliseconds

  // Retry loop guards against concurrent atomic conflicts.
  const MAX_RETRIES = 5
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const entry = await kv.get<number>(kvKey)
    const currentCount = entry.value ?? 0

    // Request exceeds the window limit — reject immediately.
    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: config.windowSeconds,
      }
    }

    const newCount = currentCount + 1

    // Atomically commit the incremented counter.
    // `.check(entry)` ensures no other writer changed the value between our
    // read and this write.  On conflict the loop retries.
    // `expireIn` resets the TTL on every successful increment so that the
    // window slides forward with activity and resets after windowSeconds of
    // inactivity (Requirement 18.5).
    const result = await kv
      .atomic()
      .check(entry)
      .set(kvKey, newCount, { expireIn })
      .commit()

    if (result.ok) {
      return {
        allowed: true,
        remaining: config.maxRequests - newCount,
        retryAfterSeconds: 0,
      }
    }
    // Atomic conflict — retry.
  }

  // Exhausted retries due to sustained contention.  Fail open so a legitimate
  // request is not silently dropped; the caller can tighten this if preferred.
  return {
    allowed: true,
    remaining: 0,
    retryAfterSeconds: 0,
  }
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Builds an HTTP 429 response with a `Retry-After` header.
 *
 * Implements Requirement 18.3.
 *
 * @param retryAfterSeconds  Value to set on the `Retry-After` header.
 */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Please wait before retrying.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}
