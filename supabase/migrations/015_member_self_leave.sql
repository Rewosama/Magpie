-- Migration 015: Allow members to remove themselves from a collection

CREATE POLICY cm_member_self_delete ON collection_members
  FOR DELETE
  USING (member_user_id = auth.uid());
