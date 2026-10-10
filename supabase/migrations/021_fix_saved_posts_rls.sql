-- Migration 021: Restore saved_posts_owner RLS policy
--
-- Root cause: migration 018 created saved_posts_owner with a WITH CHECK clause
-- that calls is_collection_owner(). Later in the same migration:
--
--   DROP FUNCTION IF EXISTS is_collection_owner(UUID) CASCADE;
--
-- PostgreSQL CASCADE drops all objects that depend on the function, including
-- the saved_posts_owner policy (which references is_collection_owner in its
-- WITH CHECK expression). The policy was never recreated after migration 018,
-- leaving saved_posts with no owner ALL policy.
--
-- Effect: authenticated users could not SELECT, INSERT, UPDATE or DELETE their
-- own saved_posts rows (only collaborator-specific policies remained).
-- The production app still worked because the issue only surfaced in fresh
-- database deployments (e.g. pgTAP integration tests via supabase test db).
--
-- Fix: recreate saved_posts_owner with the same definition intended in 018.

DROP POLICY IF EXISTS saved_posts_owner ON saved_posts;

CREATE POLICY saved_posts_owner ON saved_posts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      collection_id IS NULL                  -- koleksiyonsuz kayıt izinli
      OR is_collection_owner(collection_id)  -- kendi koleksiyonuna kayıt
      -- collaborator inserts are handled by saved_posts_collaborator_insert
    )
  );
