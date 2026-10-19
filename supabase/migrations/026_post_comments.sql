-- Migration 026: Post Comments
-- Adds a comments table for Facebook-style commenting on posts
-- Private comments visible only to author, public comments visible to all collection members

-- Create post_comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.saved_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 2000),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by post
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments(post_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Users can see their own comments (private or public) + public comments on posts they can access
CREATE POLICY "post_comments_select" ON public.post_comments
  FOR SELECT USING (
    -- User's own comments (both private and public)
    user_id = auth.uid()
    OR
    -- Public comments on posts user can access
    (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.saved_posts sp
        WHERE sp.id = post_comments.post_id
        AND (
          -- Own post
          sp.user_id = auth.uid()
          OR
          -- Post in a collection user is member of
          EXISTS (
            SELECT 1 FROM public.collection_members cm
            WHERE cm.collection_id = sp.collection_id
            AND cm.member_user_id = auth.uid()
          )
        )
      )
    )
  );

-- INSERT: Users can add comments to posts they can access
CREATE POLICY "post_comments_insert" ON public.post_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.saved_posts sp
      WHERE sp.id = post_comments.post_id
      AND (
        -- Own post
        sp.user_id = auth.uid()
        OR
        -- Post in a collection user is member of
        EXISTS (
          SELECT 1 FROM public.collection_members cm
          WHERE cm.collection_id = sp.collection_id
          AND cm.member_user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: Users can only delete their own comments
CREATE POLICY "post_comments_delete" ON public.post_comments
  FOR DELETE USING (user_id = auth.uid());
