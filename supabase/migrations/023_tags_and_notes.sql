-- Migration 023: Tags and personal notes for saved posts
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   1. note TEXT column to saved_posts (personal notes)
--   2. tags table (user-scoped tag definitions)
--   3. post_tags junction table (many-to-many)
--   4. RLS policies ensuring tags are private to their owner
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Personal note column on saved_posts ────────────────────────────────────
ALTER TABLE saved_posts ADD COLUMN IF NOT EXISTS note TEXT;

-- ── 2. Tags table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each user can have only one tag with a given name
  CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
);

-- Index for listing a user's tags
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- ── 3. Post-tag junction table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID NOT NULL REFERENCES saved_posts(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Index for reverse lookup: which posts have a given tag
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

-- ── 4. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS policies for tags ──────────────────────────────────────────────────
-- Users can only see their own tags
CREATE POLICY tags_select_own ON tags
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert tags for themselves
CREATE POLICY tags_insert_own ON tags
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own tags
CREATE POLICY tags_update_own ON tags
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own tags
CREATE POLICY tags_delete_own ON tags
  FOR DELETE
  USING (user_id = auth.uid());

-- ── 6. RLS policies for post_tags ─────────────────────────────────────────────
-- A user can see post_tags where:
--   - They own the tag (tag belongs to them)
-- This ensures users in shared collections cannot see others' tags on posts.
CREATE POLICY post_tags_select_own ON post_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tags t WHERE t.id = post_tags.tag_id AND t.user_id = auth.uid()
    )
  );

-- A user can insert a post_tag only if:
--   - They own the tag
--   - They own the post OR the post is in a collaborative collection they're a member of
CREATE POLICY post_tags_insert_own ON post_tags
  FOR INSERT
  WITH CHECK (
    -- Must own the tag
    EXISTS (
      SELECT 1 FROM tags t WHERE t.id = post_tags.tag_id AND t.user_id = auth.uid()
    )
    AND
    -- Must own the post OR be collaborator in its collection
    EXISTS (
      SELECT 1 FROM saved_posts sp
      WHERE sp.id = post_tags.post_id
        AND (
          sp.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM collection_members cm
            WHERE cm.collection_id = sp.collection_id
              AND cm.member_user_id = auth.uid()
              AND cm.member_role = 'collaborator'
          )
        )
    )
  );

-- A user can delete a post_tag only if they own the tag
CREATE POLICY post_tags_delete_own ON post_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tags t WHERE t.id = post_tags.tag_id AND t.user_id = auth.uid()
    )
  );

-- ── 7. Grant permissions ──────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON post_tags TO authenticated;
