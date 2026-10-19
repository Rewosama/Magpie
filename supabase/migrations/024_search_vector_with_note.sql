-- Migration 024: Update search_vector to include note field
-- ─────────────────────────────────────────────────────────────────────────────
-- Modifies the search_vector generated column to include the personal note
-- with weight C (lower than content_text A and author fields B).
--
-- Also updates the search_saved_posts RPC to return the note field.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop and recreate search_vector with note included ─────────────────────
-- PostgreSQL doesn't allow ALTER COLUMN on generated columns, so we must drop
-- the index, drop the column, and recreate both.

DROP INDEX IF EXISTS idx_sp_search_vector;

ALTER TABLE saved_posts DROP COLUMN IF EXISTS search_vector;

ALTER TABLE saved_posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(content_text,       '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(author_username,    '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(author_display_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(note,               '')), 'C')
  ) STORED;

CREATE INDEX idx_sp_search_vector ON saved_posts USING gin (search_vector);

-- ── 2. Update search_saved_posts RPC to return note ───────────────────────────
-- Must drop first because return type changes (Postgres doesn't allow OR REPLACE for this)
DROP FUNCTION IF EXISTS search_saved_posts(text, uuid, int);

CREATE FUNCTION search_saved_posts(
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
  note                text,
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
    sp.note,
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
