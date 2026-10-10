-- Migration: 002_saved_posts_table.sql
-- Creates the saved_posts table with all required columns, constraints, and indexes.
-- Requirements: 14.2, 19 (thumbnail_url for Supabase Storage persistence)
-- Depends on: 001_collections_table.sql (collections table must exist)

-- Enable pg_trgm for GIN-based trigram full-text search on content_text
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: saved_posts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_posts (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_url            TEXT,
  post_type           TEXT,
  platform            TEXT,
  author_username     TEXT,
  author_display_name TEXT,
  author_avatar_url   TEXT,
  content_text        TEXT,
  media_urls          TEXT[],
  post_timestamp      TIMESTAMPTZ,
  saved_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  collection_id       UUID          REFERENCES collections(id) ON DELETE SET NULL,
  raw_metadata        JSONB,
  thumbnail_url       TEXT,

  -- Enables idempotent upserts: saving the same URL twice updates rather than duplicates
  -- Used by the save-post Edge Function: ON CONFLICT (user_id, post_url) DO UPDATE
  CONSTRAINT uq_saved_posts_user_url UNIQUE (user_id, post_url)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Primary feed query: fetch all posts for a user ordered by most-recently saved
CREATE INDEX IF NOT EXISTS idx_sp_user_saved_at
  ON saved_posts (user_id, saved_at DESC);

-- Collection filter: quickly retrieve all posts belonging to a given collection
CREATE INDEX IF NOT EXISTS idx_sp_collection
  ON saved_posts (collection_id);

-- Full-text trigram search on post captions / tweet text (Requirement 17.2)
CREATE INDEX IF NOT EXISTS idx_sp_content_trgm
  ON saved_posts USING gin (content_text gin_trgm_ops);
