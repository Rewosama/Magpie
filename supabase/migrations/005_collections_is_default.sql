-- Migration 005: Add is_default flag to collections table
-- Allows one collection per user to be designated as the default save target.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Only one collection per user can be the default at a time.
-- The application enforces this in the manage-collection Edge Function
-- (clear all defaults before setting a new one).
-- This partial index makes the uniqueness efficient without blocking
-- rows where is_default = false.
CREATE UNIQUE INDEX IF NOT EXISTS collections_one_default_per_user
  ON collections (user_id)
  WHERE is_default = true;
