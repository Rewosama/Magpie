-- 01_rls_collections_and_posts.sql
-- Tests RLS policies for collections and saved_posts tables:
--   - owner: full access to own rows
--   - non-member: cannot see another user's collections or posts
--   - viewer member: SELECT only on shared collection posts
--   - collaborator member: SELECT + INSERT (own user_id) + DELETE (own posts)
--   - evicted member: loses access after membership deletion

BEGIN;

SELECT plan(19);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (run as postgres/service_role to bypass RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Create two test users
INSERT INTO auth.users (id, email, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner@test.magpie', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'viewer@test.magpie', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'collab@test.magpie', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'stranger@test.magpie', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.collections (id, user_id, name, is_default)
VALUES ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner-col', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.saved_posts (id, user_id, collection_id, post_url, canonical_url, platform, post_type)
VALUES
  ('a0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'https://www.instagram.com/p/TEST001/',
   'https://www.instagram.com/p/TEST001/',
   'instagram', 'post')
ON CONFLICT (id) DO NOTHING;

-- Viewer member
INSERT INTO public.collection_members (collection_id, member_user_id, member_role)
VALUES ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'viewer')
ON CONFLICT DO NOTHING;

-- Collaborator member
INSERT INTO public.collection_members (collection_id, member_user_id, member_role)
VALUES ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'collaborator')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: set RLS context for a given user
-- ─────────────────────────────────────────────────────────────────────────────
-- Usage: SET LOCAL ROLE authenticated;
--        SELECT set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. OWNER tests
-- ─────────────────────────────────────────────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.collections WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  1, '1-1: owner can SELECT own collection'
);

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'),
  1, '1-2: owner can SELECT own post'
);

-- Owner can INSERT to own collection (test via saved_posts_owner WITH CHECK)
SELECT lives_ok(
  $$INSERT INTO public.saved_posts (id, user_id, collection_id, post_url, canonical_url, platform, post_type)
    VALUES ('a1000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001',
            'https://www.instagram.com/p/INSERT01/',
            'https://www.instagram.com/p/INSERT01/',
            'instagram', 'post')$$,
  '1-3: owner can INSERT post to own collection'
);

-- Cleanup insert
DELETE FROM public.saved_posts WHERE id = 'a1000000-0000-0000-0000-000000000001';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. STRANGER (non-member) tests
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.collections WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  0, '2-1: stranger cannot SELECT another user''s collection'
);

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'),
  0, '2-2: stranger cannot SELECT posts from another user''s collection'
);

-- Stranger cannot INSERT to someone else's collection
SELECT throws_ok(
  $$INSERT INTO public.saved_posts (id, user_id, collection_id, post_url, canonical_url, platform, post_type)
    VALUES ('a2000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000004',
            'c0000000-0000-0000-0000-000000000001',
            'https://www.instagram.com/p/INTRUDE1/',
            'https://www.instagram.com/p/INTRUDE1/',
            'instagram', 'post')$$,
  '42501',
  NULL,
  '2-3: stranger cannot INSERT post to another user''s collection (RLS violation)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VIEWER member tests
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.collections WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  1, '3-1: viewer can SELECT shared collection metadata'
);

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'),
  1, '3-2: viewer can SELECT posts in shared collection'
);

-- Viewer cannot INSERT to shared collection
SELECT throws_ok(
  $$INSERT INTO public.saved_posts (id, user_id, collection_id, post_url, canonical_url, platform, post_type)
    VALUES ('a3000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            'c0000000-0000-0000-0000-000000000001',
            'https://www.instagram.com/p/VIEWER01/',
            'https://www.instagram.com/p/VIEWER01/',
            'instagram', 'post')$$,
  '42501',
  NULL,
  '3-3: viewer cannot INSERT post to shared collection (RLS violation)'
);

-- Viewer DELETE attempt: RLS USING clause filters the row; 0 rows deleted, no exception.
-- PostgreSQL intentionally returns 0 rows instead of an error to prevent info leakage.
DELETE FROM public.saved_posts WHERE id = 'a0000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts
   WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  1, '3-4: viewer DELETE attempt does not remove post (RLS USING returns 0 rows, no error)'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. COLLABORATOR member tests
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'),
  1, '4-1: collaborator can SELECT posts in shared collection'
);

-- Collaborator can INSERT with own user_id
SELECT lives_ok(
  $$INSERT INTO public.saved_posts (id, user_id, collection_id, post_url, canonical_url, platform, post_type)
    VALUES ('a4000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000003',
            'c0000000-0000-0000-0000-000000000001',
            'https://www.instagram.com/p/COLLAB01/',
            'https://www.instagram.com/p/COLLAB01/',
            'instagram', 'post')$$,
  '4-2: collaborator can INSERT post with own user_id'
);

-- Collaborator can DELETE own post
SELECT lives_ok(
  $$DELETE FROM public.saved_posts WHERE id = 'a4000000-0000-0000-0000-000000000001'$$,
  '4-3: collaborator can DELETE own post'
);

-- Collaborator cannot DELETE owner's post
SELECT is(
  (SELECT count(*)::int FROM public.saved_posts
   WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  1, '4-4: owner post still exists before collaborator delete attempt'
);

-- This should silently not delete (RLS USING check fails → 0 rows affected)
DELETE FROM public.saved_posts
WHERE id = 'a0000000-0000-0000-0000-000000000001'
  AND user_id = '00000000-0000-0000-0000-000000000003'; -- wrong user_id

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  1, '4-5: collaborator cannot DELETE another user''s post'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. EVICTED member — loses access after membership deleted
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove viewer membership (done as postgres to bypass RLS)
RESET role;
DELETE FROM public.collection_members
WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'
  AND member_user_id = '00000000-0000-0000-0000-000000000002';

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.saved_posts WHERE collection_id = 'c0000000-0000-0000-0000-000000000001'),
  0, '5-1: evicted viewer can no longer SELECT posts'
);

SELECT is(
  (SELECT count(*)::int FROM public.collections WHERE id = 'c0000000-0000-0000-0000-000000000001'),
  0, '5-2: evicted viewer can no longer SELECT collection'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. is_collection_owner() SECURITY DEFINER — cannot be spoofed
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

SELECT is(
  public.is_collection_owner('c0000000-0000-0000-0000-000000000001'),
  false, '6-1: stranger is_collection_owner() returns false'
);

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

SELECT is(
  public.is_collection_owner('c0000000-0000-0000-0000-000000000001'),
  true, '6-2: owner is_collection_owner() returns true'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup
-- ─────────────────────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
