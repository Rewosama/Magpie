-- Migration 022: Restore ci_owner_insert RLS policy on collection_invites
--
-- Root cause: same as migration 021 (saved_posts_owner).
-- Migration 018 executed DROP FUNCTION is_collection_owner(UUID) CASCADE, which
-- also dropped every policy that references the function in its expression.
--
-- ci_owner_insert was created in migration 011:
--   WITH CHECK (created_by = auth.uid() AND is_collection_owner(collection_id))
-- This dependency caused it to be dropped by the CASCADE.
-- Migration 018 recreated cm_owner_select, cm_owner_delete, ci_owner_delete
-- but NOT ci_owner_insert — leaving collection owners unable to create invite codes.

DROP POLICY IF EXISTS ci_owner_insert ON collection_invites;

CREATE POLICY ci_owner_insert ON collection_invites
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_collection_owner(collection_id)
  );
