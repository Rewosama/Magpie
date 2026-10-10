/**
 * invite-code.ts
 * Pure utility for generating single-use invite codes.
 * Kept separate from server actions so it can be tested in isolation.
 *
 * Security notes:
 *  - Uses crypto.getRandomValues (CSPRNG) instead of Math.random (PRNG).
 *  - Rejection sampling eliminates modulo bias (256 % 36 != 0).
 *  - 36^8 ≈ 2.8 trillion combinations, ~41 bits of entropy.
 */

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 36 chars
// Largest multiple of 36 that fits in a byte (0-255): 252
// Bytes >= 252 are rejected to avoid modulo bias.
const MAX_UNBIASED = 256 - (256 % CHARSET.length); // 252

/**
 * Generates a cryptographically secure 8-character uppercase alphanumeric code.
 * Format invariant: /^[A-Z0-9]{8}$/
 */
export function generateCode(): string {
  let code = "";
  while (code.length < 8) {
    // Request extra bytes so we rarely need a second iteration
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length; i++) {
      if (code.length >= 8) break;
      const byte = buf[i];
      if (byte < MAX_UNBIASED) {
        code += CHARSET[byte % CHARSET.length];
      }
      // bytes >= MAX_UNBIASED are discarded (rejection sampling)
    }
  }
  return code;
}
