-- Migration 027: Add tags to search
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates a function that includes post tags in search results.
-- Since tags are in a separate table, we create a helper function.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop and recreate search function to include tags
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
  WITH post_tags_agg AS (
    -- Aggregate tag names per post for search
    SELECT 
      pt.post_id,
      string_agg(t.name, ' ') AS tag_names
    FROM public.post_tags pt
    JOIN public.tags t ON t.id = pt.tag_id
    GROUP BY pt.post_id
  )
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
  LEFT JOIN post_tags_agg pta ON pta.post_id = sp.id
  WHERE (
    -- Search in existing search_vector (content, author, notes)
    sp.search_vector @@ websearch_to_tsquery('simple', p_query)
    OR
    -- Also search in tag names
    to_tsvector('simple', coalesce(pta.tag_names, '')) @@ websearch_to_tsquery('simple', p_query)
  )
    AND (p_collection_id IS NULL OR sp.collection_id = p_collection_id)
  ORDER BY
    -- Rank by relevance (prioritize search_vector matches)
    ts_rank(sp.search_vector, websearch_to_tsquery('simple', p_query)) DESC,
    sp.saved_at DESC,
    sp.id DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_saved_posts(text, uuid, int) TO authenticated;
