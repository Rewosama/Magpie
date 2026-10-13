-- Migration 009: Collaborative Collection support
-- Adds member_role to collection_members and grants_role to collection_invites.

-- ── Schema changes ────────────────────────────────────────────────────────────

ALTER TABLE collection_members
  ADD COLUMN member_role TEXT NOT NULL DEFAULT 'viewer'
  CHECK (member_role IN ('viewer', 'collaborator'));

ALTER TABLE collection_invites
  ADD COLUMN grants_role TEXT NOT NULL DEFAULT 'viewer'
  CHECK (grants_role IN ('viewer', 'collaborator'));

-- ── RLS: allow collaborators to insert their own posts into shared collections ─

-- Collaborators can INSERT posts into collections they've joined as collaborator.
-- user_id must still equal auth.uid() (they're saving under their own identity).
CREATE POLICY saved_posts_collaborator_insert ON saved_posts
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND collection_id IN (
      SELECT collection_id FROM collection_members
      WHERE member_user_id = auth.uid()
        AND member_role = 'collaborator'
    )
  );

-- Collaborators can DELETE their OWN posts from collaborative collections.
-- user_id = auth.uid() ensures they can only delete posts they added.
CREATE POLICY saved_posts_collaborator_delete ON saved_posts
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND collection_id IN (
      SELECT collection_id FROM collection_members
      WHERE member_user_id = auth.uid()
        AND member_role = 'collaborator'
    )
  );

-- ── Update redeem_invite to capture grants_role ───────────────────────────────

-- Drop first because return type changes (Postgres doesn't allow OR REPLACE for this)
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
  SELECT * INTO v_invite
  FROM collection_invites
  WHERE code = p_code
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

  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_invite.collection_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'IS_OWNER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = v_invite.collection_id AND member_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  UPDATE collection_invites
  SET used_at = now(), used_by = p_user_id
  WHERE id = v_invite.id;

  -- Use grants_role from the invite
  INSERT INTO collection_members (collection_id, member_user_id, member_role)
  VALUES (v_invite.collection_id, p_user_id, v_invite.grants_role);

  SELECT name INTO v_col_name FROM collections WHERE id = v_invite.collection_id;

  RETURN QUERY SELECT v_invite.collection_id, v_col_name, v_invite.grants_role;
END;
$$;

-- ── Update get_shared_collections_with_owner to include member_role ───────────

DROP FUNCTION IF EXISTS get_shared_collections_with_owner(UUID);

CREATE OR REPLACE FUNCTION get_shared_collections_with_owner(p_user_id UUID)
RETURNS TABLE (
  collection_id   UUID,
  collection_name TEXT,
  owner_email     TEXT,
  joined_at       TIMESTAMPTZ,
  member_role     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT cm.collection_id, c.name, u.email::TEXT, cm.joined_at, cm.member_role
  FROM collection_members cm
  JOIN collections c ON c.id = cm.collection_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE cm.member_user_id = p_user_id
  ORDER BY cm.joined_at;
END;
$$;
