-- Migration 006: Backfill is_default for existing users
-- Sets the oldest collection as the default for every user who doesn't
-- already have one (i.e., all users created before migration 005).

UPDATE collections
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (user_id) id
  FROM collections
  WHERE user_id NOT IN (
    SELECT user_id FROM collections WHERE is_default = true
  )
  ORDER BY user_id, created_at ASC
);
