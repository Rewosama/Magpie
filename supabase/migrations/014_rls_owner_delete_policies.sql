-- Migration 014: Add owner DELETE policies so service_role key is not needed
-- for revokeCollectionMember and revokeInviteCode.

-- Collection owners can delete any member from their collection
CREATE POLICY cm_owner_delete ON collection_members
  FOR DELETE
  USING (is_collection_owner(collection_id));

-- Collection owners can delete invite codes for their collection
CREATE POLICY ci_owner_delete ON collection_invites
  FOR DELETE
  USING (is_collection_owner(collection_id));
