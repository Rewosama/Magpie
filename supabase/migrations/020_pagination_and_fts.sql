-- Migration 020: cursor-based pagination + tsvector full-text search
-- ─────────────────────────────────────────────────────────────────────────────
-- Performance impact (vs previous state):
--   ILIKE '%q%'    → O(n) seq scan even with trigram
--   search_vector @@ websearch_to_tsquery('simple', q)
--                  → O(log n) GIN, covers content_text + author fields + ts_rank
--
--   OFFSET n       → DB discards n rows on every page, linear cost
--   Keyset cursor  → index seek on (saved_at DESC, id DESC), O(log n) at any depth
--
--   idx_sp_user_saved_at (user_id, saved_at DESC) — no id tie-break
--   idx_sp_user_cursor   (user_id, saved_at DESC, id DESC) — covers cursor exactly
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extensions ─────────────────────────────────────────────────────────────
-- unaccent: accent-insensitive matching.
-- Not used in the generated column because PostgreSQL requires IMMUTABLE
-- expressions there; unaccent() is STABLE. An IMMUTABLE wrapper can be layered
-- on top later if needed. The extension is installed now so it is available.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── 2. Generated stored tsvector column ───────────────────────────────────────
-- 'simple' config: lowercases tokens but does NOT stem. This is correct for
-- Turkish — PostgreSQL ships no Turkish stemmer and English/other stemmers
-- produce wrong stems. 'simple' avoids wrong stemming while still enabling
-- prefix/exact word search.
--
-- Weights:  A (highest) → content_text
--           B           → author_username, author_display_name
ALTER TABLE saved_posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(content_text,       '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(author_username,     '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(author_display_name, '')), 'B')
  ) STORED;

-- ── 3. GIN index on tsvector ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sp_search_vector
  ON saved_posts USING gin (search_vector);

-- ── 4. Cursor-based pagination indexes ────────────────────────────────────────
-- Feed without collection filter.
-- Supports:
--   WHERE user_id = $1
--     AND (saved_at < cursor_at
--          OR (saved_at = cursor_at AND id < cursor_id))
--   ORDER BY saved_at DESC, id DESC  LIMIT n
CREATE INDEX IF NOT EXISTS idx_sp_user_cursor
  ON saved_posts (user_id, saved_at DESC, id DESC);

-- Feed with collection filter (shared collections included via RLS).
CREATE INDEX IF NOT EXISTS idx_sp_collection_cursor
  ON saved_posts (collection_id, saved_at DESC, id DESC);

-- ── 5. search_saved_posts() RPC ────────────────────────────────────────────────
-- Returns posts matching p_query, ordered by ts_rank DESC then saved_at DESC.
-- Uses SECURITY INVOKER (default) so existing RLS policies on saved_posts are
-- enforced automatically — users see only their own posts and posts in
-- collections they are members of (no manual user_id filter needed).
-- p_collection_id = NULL → search across all accessible posts.
CREATE OR REPLACE FUNCTION search_saved_posts(
  p_query         text,
  p_collection_id uuid  DEFAULT NULL,
  p_limit         int   DEFAULT 100
)
RETURNS TABLE (
  id                  uuid,
  user_id             uuid,
  post_url            text,
  post_type           text,
  platform            text,
  author_username     text,
  author_display_name text,
  author_avatar_url   text,
  content_text        text,
  media_urls          text[],
  post_timestamp      timestamptz,
  saved_at            timestamptz,
  collection_id       uuid,
  raw_metadata        jsonb,
  thumbnail_url       text,
  canonical_url       text,
  collection_name     text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    sp.id,
    sp.user_id,
    sp.post_url,
    sp.post_type,
    sp.platform,
    sp.author_username,
    sp.author_display_name,
    sp.author_avatar_url,
    sp.content_text,
    sp.media_urls,
    sp.post_timestamp,
    sp.saved_at,
    sp.collection_id,
    sp.raw_metadata,
    sp.thumbnail_url,
    sp.canonical_url,
    c.name AS collection_name
  FROM public.saved_posts sp
  LEFT JOIN public.collections c ON c.id = sp.collection_id
  WHERE sp.search_vector @@ websearch_to_tsquery('simple', p_query)
    AND (p_collection_id IS NULL OR sp.collection_id = p_collection_id)
  ORDER BY
    ts_rank(sp.search_vector, websearch_to_tsquery('simple', p_query)) DESC,
    sp.saved_at DESC,
    sp.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_saved_posts(text, uuid, int) TO authenticated;
