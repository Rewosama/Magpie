-- Migration 011: Allow collection owners to insert invite codes
-- collection_invites had SELECT policy but no INSERT policy.

CREATE POLICY ci_owner_insert ON collection_invites
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_collection_owner(collection_id)
  );
