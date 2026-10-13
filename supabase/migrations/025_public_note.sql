-- Migration 025: Public note for collaborative collections
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds a public_note column to saved_posts that is visible to all collection members.
-- The existing 'note' column remains private (only visible to post owner).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS public_note TEXT;

-- Update search_vector to include public_note
DROP INDEX IF EXISTS idx_sp_search_vector;

ALTER TABLE saved_posts DROP COLUMN IF EXISTS search_vector;

ALTER TABLE saved_posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(content_text,       '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(author_username,    '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(author_display_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(note,               '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(public_note,        '')), 'C')
  ) STORED;

CREATE INDEX idx_sp_search_vector ON saved_posts USING gin (search_vector);

-- Update search_saved_posts to return public_note
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
  public_note         text,
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
    -- Only return private note if user owns the post
    CASE WHEN sp.user_id = auth.uid() THEN sp.note ELSE NULL END AS note,
    sp.public_note,
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
