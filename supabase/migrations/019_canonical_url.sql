-- Migration 019: canonical_url for cross-format deduplication
--
-- Problem: UNIQUE(user_id, post_url) compares raw strings, so
--   twitter.com/u/status/123  and  x.com/u/status/123?s=20
--   both pass uniqueness even though they are the same tweet.
--
-- Solution:
--   1. Add canonical_url TEXT column.
--   2. Backfill from post_url using SQL-level normalisation.
--   3. Remove duplicate rows kept by oldest saved_at.
--   4. Add UNIQUE(user_id, canonical_url).
--
-- Note: UNIQUE(collection_id, canonical_url) was considered but rejected
--   because collection_id is nullable; PostgreSQL treats NULL ≠ NULL in
--   UNIQUE constraints, so two rows with NULL collection_id + same canonical
--   would not conflict. UNIQUE(user_id, canonical_url) gives full coverage.

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS canonical_url TEXT;

-- ── 2. Backfill Instagram ─────────────────────────────────────────────────────
-- Strip query/hash, normalise host, /reels/ → /reel/, ensure trailing slash.
UPDATE saved_posts
SET canonical_url =
  'https://www.instagram.com/' ||
  rtrim(
    replace(
      regexp_replace(
        -- Remove leading "https://(www.)?instagram.com/"
        regexp_replace(
          -- Strip query string and hash
          regexp_replace(post_url, '[?#].*$', ''),
          '^https?://(www\.)?instagram\.com/', ''
        ),
        -- Strip leading username segment when format is username/type/shortcode
        '^[^/]+/(p|reel|reels|tv)/',
        '\1/'
      ),
      '/reels/', '/reel/'
    ),
    '/'
  ) || '/'
WHERE platform = 'instagram'
  AND canonical_url IS NULL
  AND post_url ~ 'instagram\.com/(p|reel|reels|tv)/[\w-]+';

-- ── 3. Backfill X / Twitter ───────────────────────────────────────────────────
-- Extract tweet ID from any /status/{id} pattern, build stable canonical.
UPDATE saved_posts
SET canonical_url =
  'https://x.com/i/web/status/' ||
  (regexp_match(post_url, '/status/(\d+)'))[1]
WHERE platform IN ('x', 'twitter')
  AND canonical_url IS NULL
  AND post_url ~ '/status/\d+';

-- ── 4. Fallback: anything else keeps post_url as canonical ────────────────────
UPDATE saved_posts
SET canonical_url = post_url
WHERE canonical_url IS NULL;

-- ── 5. Remove duplicates before adding constraint ─────────────────────────────
-- Keep the oldest row (smallest saved_at) per (user_id, canonical_url).
-- Thumbnail and other data from the kept row are preserved.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, canonical_url
           ORDER BY saved_at ASC   -- oldest wins
         ) AS rn
  FROM saved_posts
  WHERE canonical_url IS NOT NULL
)
DELETE FROM saved_posts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── 6. Add constraint ─────────────────────────────────────────────────────────
ALTER TABLE saved_posts
  ALTER COLUMN canonical_url SET NOT NULL;

ALTER TABLE saved_posts
  ADD CONSTRAINT uq_saved_posts_user_canonical
  UNIQUE (user_id, canonical_url);
