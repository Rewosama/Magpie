-- Migration 012: Fix column ambiguity in redeem_invite
-- RETURNS TABLE declares a column named "collection_id" which conflicts
-- with the same column name inside the function body queries.
-- Fix: qualify every collection_id reference with its table name.

DROP FUNCTION IF EXISTS redeem_invite(TEXT, UUID);

CREATE OR REPLACE FUNCTION redeem_invite(p_code TEXT, p_user_id UUID)
RETURNS TABLE (collection_id UUID, collection_name TEXT, member_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite   collection_invites%ROWTYPE;
  v_col_name TEXT;
BEGIN
  -- Lock the invite row to prevent concurrent double-redemption
  SELECT * INTO v_invite
  FROM collection_invites ci
  WHERE ci.code = p_code
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_USED';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED';
  END IF;

  -- Collection owner cannot join their own collection
  IF EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = v_invite.collection_id
      AND c.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'IS_OWNER';
  END IF;

  -- Already a member
  IF EXISTS (
    SELECT 1 FROM collection_members cm
    WHERE cm.collection_id = v_invite.collection_id
      AND cm.member_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  -- Mark invite as used
  UPDATE collection_invites ci
  SET used_at = now(), used_by = p_user_id
  WHERE ci.id = v_invite.id;

  -- Create membership
  INSERT INTO collection_members (collection_id, member_user_id, member_role)
  VALUES (v_invite.collection_id, p_user_id, v_invite.grants_role);

  -- Return collection info for the UI confirmation message
  SELECT c.name INTO v_col_name
  FROM collections c
  WHERE c.id = v_invite.collection_id;

  RETURN QUERY
  SELECT v_invite.collection_id, v_col_name, v_invite.grants_role;
END;
$$;
