/**
 * adapters/x/selectors.ts
 * DOM selectors for X (Twitter).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Post Container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tweet article selector using data-testid.
 * More stable than class names which change frequently.
 */
export const X_TWEET_SELECTOR = 'article[data-testid="tweet"]';

// ─────────────────────────────────────────────────────────────────────────────
// Within Tweet Selectors
// ─────────────────────────────────────────────────────────────────────────────

export const WITHIN_TWEET = {
  authorName: '[data-testid="User-Name"]',
  authorAvatar: '[data-testid="Tweet-User-Avatar"] img',
  tweetText: '[data-testid="tweetText"]',
  tweetLink: 'a[href*="/status/"]',
  timestamp: "time[datetime]",
  photo: '[data-testid="tweetPhoto"] img',
  video: "video source",
  actionBar: 'div[role="group"]',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// URL Patterns
// ─────────────────────────────────────────────────────────────────────────────

export const X_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "www.x.com",
  "www.twitter.com",
]);

/** Tweet ID pattern (numeric only) */
export const TWEET_ID_RE = /^\d+$/;
