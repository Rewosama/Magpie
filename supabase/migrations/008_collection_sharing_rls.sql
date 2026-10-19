-- Migration 008: RLS policies + stored procedures for Shared Collection feature

-- ── RLS: collection_invites ───────────────────────────────────────────────────

ALTER TABLE collection_invites ENABLE ROW LEVEL SECURITY;

-- Owners can read the invite codes they created
CREATE POLICY ci_owner_select ON collection_invites
  FOR SELECT USING (created_by = auth.uid());

-- ── RLS: collection_members ───────────────────────────────────────────────────

ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships (drives the sidebar shared section)
CREATE POLICY cm_member_select ON collection_members
  FOR SELECT USING (member_user_id = auth.uid());

-- Owners can see all members of their collections
CREATE POLICY cm_owner_select ON collection_members
  FOR SELECT USING (
    collection_id IN (
      SELECT id FROM collections WHERE user_id = auth.uid()
    )
  );

-- ── RLS: collections (updated) ────────────────────────────────────────────────

DROP POLICY IF EXISTS collections_owner ON collections;

-- Owner retains full CRUD access
CREATE POLICY collections_owner ON collections
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Members get read-only access to the collection metadata they joined
CREATE POLICY collections_member_select ON collections
  FOR SELECT
  USING (
    id IN (
      SELECT collection_id FROM collection_members
      WHERE member_user_id = auth.uid()
    )
  );

-- ── RLS: saved_posts (updated) ────────────────────────────────────────────────

DROP POLICY IF EXISTS saved_posts_owner ON saved_posts;

-- Owner retains full CRUD access
CREATE POLICY saved_posts_owner ON saved_posts
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Members get read-only access to posts inside their shared collections
CREATE POLICY saved_posts_member_select ON saved_posts
  FOR SELECT
  USING (
    collection_id IN (
      SELECT collection_id FROM collection_members
      WHERE member_user_id = auth.uid()
    )
  );

-- ── Stored Procedures ─────────────────────────────────────────────────────────

-- redeem_invite: atomic invite code redemption (single-use, 24h expiry)
CREATE OR REPLACE FUNCTION redeem_invite(p_code TEXT, p_user_id UUID)
RETURNS TABLE (collection_id UUID, collection_name TEXT)
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

  -- Collection owner cannot join their own collection
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_invite.collection_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'IS_OWNER';
  END IF;

  -- Already a member
  IF EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = v_invite.collection_id AND member_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  -- Mark invite as used
  UPDATE collection_invites
  SET used_at = now(), used_by = p_user_id
  WHERE id = v_invite.id;

  -- Create membership
  INSERT INTO collection_members (collection_id, member_user_id)
  VALUES (v_invite.collection_id, p_user_id);

  -- Return collection info for the UI confirmation message
  SELECT name INTO v_col_name FROM collections WHERE id = v_invite.collection_id;

  RETURN QUERY SELECT v_invite.collection_id, v_col_name;
END;
$$;

-- get_members_with_email: lists members of a collection with their emails (owner only)
CREATE OR REPLACE FUNCTION get_members_with_email(p_collection_id UUID)
RETURNS TABLE (member_user_id UUID, email TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT cm.member_user_id, u.email::TEXT, cm.joined_at
  FROM collection_members cm
  JOIN auth.users u ON u.id = cm.member_user_id
  WHERE cm.collection_id = p_collection_id
  ORDER BY cm.joined_at;
END;
$$;

-- get_shared_collections_with_owner: returns all collections the user has joined, with owner email
CREATE OR REPLACE FUNCTION get_shared_collections_with_owner(p_user_id UUID)
RETURNS TABLE (
  collection_id   UUID,
  collection_name TEXT,
  owner_email     TEXT,
  joined_at       TIMESTAMPTZ
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
  SELECT cm.collection_id, c.name, u.email::TEXT, cm.joined_at
  FROM collection_members cm
  JOIN collections c ON c.id = cm.collection_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE cm.member_user_id = p_user_id
  ORDER BY cm.joined_at;
END;
$$;
