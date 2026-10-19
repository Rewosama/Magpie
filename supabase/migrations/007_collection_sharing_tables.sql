-- Migration 007: Shared Collection tables
-- Creates collection_invites and collection_members for the invite-code sharing feature.

-- ── collection_invites ────────────────────────────────────────────────────────

CREATE TABLE collection_invites (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  UUID        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code           CHAR(8)     NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  used_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_invite_code UNIQUE (code)
);

CREATE INDEX idx_ci_code       ON collection_invites (code);
CREATE INDEX idx_ci_collection ON collection_invites (collection_id);

-- ── collection_members ────────────────────────────────────────────────────────

CREATE TABLE collection_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  UUID        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  member_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_membership UNIQUE (collection_id, member_user_id)
);

CREATE INDEX idx_cm_member     ON collection_members (member_user_id);
CREATE INDEX idx_cm_collection ON collection_members (collection_id);
