-- Migration 016: Allow users to delete their own thumbnails from storage
-- Path pattern: {user_id}/{post_id}.{ext}
-- Users can only delete objects in their own folder.

CREATE POLICY thumbnails_owner_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'thumbnails'
    AND name LIKE (auth.uid()::text || '/%')
  );
