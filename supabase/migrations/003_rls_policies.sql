-- Migration 003: Enable RLS and create access policies
-- Requirements: 14.3, 14.4, 14.5, 19.7
-- Depends on: 001_collections_table.sql, 002_saved_posts_table.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security: collections
-- Requirements: 14.3 — users may only access rows where user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collections_owner ON collections;

CREATE POLICY collections_owner ON collections
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security: saved_posts
-- Requirements: 14.4 — users may only access rows where user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_posts_owner ON saved_posts;

CREATE POLICY saved_posts_owner ON saved_posts
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Storage: public read policy for thumbnails bucket
-- Requirements: 19.7 — bucket must allow public read without authentication
-- The bucket named 'thumbnails' must be created in the Supabase dashboard
-- (or via the Management API) before this policy takes effect.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS thumbnails_public_read ON storage.objects;

CREATE POLICY thumbnails_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'thumbnails');
