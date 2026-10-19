-- Migration 013: Member audit (which code) + active invites + owner in list

-- Updated get_members_with_email: includes owner as first row + invite code used
DROP FUNCTION IF EXISTS get_members_with_email(UUID);

CREATE OR REPLACE FUNCTION get_members_with_email(p_collection_id UUID)
RETURNS TABLE (
  member_user_id UUID,
  email          TEXT,
  joined_at      TIMESTAMPTZ,
  invite_code    TEXT,
  is_owner       BOOLEAN,
  member_role    TEXT
)
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

  -- Owner row first
  RETURN QUERY
  SELECT
    c.user_id,
    u.email::TEXT,
    c.created_at,
    NULL::TEXT,
    TRUE,
    'owner'::TEXT
  FROM collections c
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.id = p_collection_id;

  -- Members with the code they used
  RETURN QUERY
  SELECT
    cm.member_user_id,
    u.email::TEXT,
    cm.joined_at,
    ci.code::TEXT,
    FALSE,
    cm.member_role
  FROM collection_members cm
  JOIN auth.users u ON u.id = cm.member_user_id
  LEFT JOIN collection_invites ci
    ON ci.used_by = cm.member_user_id
   AND ci.collection_id = cm.collection_id
  WHERE cm.collection_id = p_collection_id
  ORDER BY cm.joined_at;
END;
$$;

-- New: list active (unused, non-expired) invite codes
CREATE OR REPLACE FUNCTION get_active_invites(p_collection_id UUID)
RETURNS TABLE (
  invite_id    UUID,
  code         CHAR(8),
  grants_role  TEXT,
  expires_at   TIMESTAMPTZ,
  created_by   UUID,
  creator_email TEXT
)
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
  SELECT
    ci.id,
    ci.code,
    ci.grants_role,
    ci.expires_at,
    ci.created_by,
    u.email::TEXT
  FROM collection_invites ci
  JOIN auth.users u ON u.id = ci.created_by
  WHERE ci.collection_id = p_collection_id
    AND ci.used_at IS NULL
    AND ci.expires_at > now()
  ORDER BY ci.expires_at;
END;
$$;
