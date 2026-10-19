-- 02_rls_invite_codes.sql
-- Tests invite code flow under RLS:
--   - expired code is rejected by redeem_invite()
--   - already-used code is rejected
--   - rate limiting triggers after 5 failures in 15 minutes
--   - collection owner can list their own invite codes
--   - non-owner cannot list other collections' invite codes

BEGIN;

SELECT plan(7);

-- ─── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (id, email, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'inv-owner@test.magpie', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'inv-redeemer@test.magpie', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'inv-rate@test.magpie', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.collections (id, user_id, name)
VALUES ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'inv-col')
ON CONFLICT (id) DO NOTHING;

-- An expired invite code
INSERT INTO public.collection_invites (id, collection_id, created_by, code, expires_at, grants_role)
VALUES ('b0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'EXPIR3D1',
        now() - interval '2 hours',  -- already expired
        'viewer')
ON CONFLICT (id) DO NOTHING;

-- An already-used invite code
INSERT INTO public.collection_invites (id, collection_id, created_by, code, expires_at, used_at, used_by, grants_role)
VALUES ('b0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'USED0001',
        now() + interval '24 hours',
        now() - interval '1 hour',
        '10000000-0000-0000-0000-000000000002',
        'viewer')
ON CONFLICT (id) DO NOTHING;

-- A valid invite code
INSERT INTO public.collection_invites (id, collection_id, created_by, code, expires_at, grants_role)
VALUES ('b0000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'VALID001',
        now() + interval '24 hours',
        'viewer')
ON CONFLICT (id) DO NOTHING;

-- ─── 1. Expired code → redeem_invite() raises INVALID ────────────────────────
-- redeem_invite() validates auth.uid() = p_user_id before checking the code.
-- Set JWT so auth.uid() returns the redeemer's ID.
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

SELECT throws_ok(
  $$SELECT * FROM public.redeem_invite('EXPIR3D1', '10000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'INVALID',
  '1-1: expired code raises INVALID'
);

-- ─── 2. Already-used code → raises INVALID ───────────────────────────────────

SELECT throws_ok(
  $$SELECT * FROM public.redeem_invite('USED0001', '10000000-0000-0000-0000-000000000002')$$,
  'P0001',
  'INVALID',
  '2-1: already-used code raises INVALID'
);

-- ─── 3. Rate limit triggers after 5 failures ─────────────────────────────────

-- Seed 5 failed attempts for rate-limit test user
INSERT INTO public.invite_attempts (user_id, attempted_at)
SELECT '10000000-0000-0000-0000-000000000003', now() - (i * interval '1 minute')
FROM generate_series(1, 5) AS i;

-- Set JWT for the rate-limited user
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

SELECT throws_ok(
  $$SELECT * FROM public.redeem_invite('VALID001', '10000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'RATE_LIMITED',
  '3-1: rate limit kicks in after 5 recent failures'
);

-- ─── 4. Owner can SELECT own invite codes ────────────────────────────────────

SET LOCAL role = authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.collection_invites
   WHERE collection_id = 'd0000000-0000-0000-0000-000000000001'),
  3, '4-1: owner can SELECT all invite codes for own collection'
);

-- ─── 5. Non-owner cannot SELECT invite codes ─────────────────────────────────

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.collection_invites
   WHERE collection_id = 'd0000000-0000-0000-0000-000000000001'),
  0, '5-1: non-owner cannot SELECT invite codes'
);

-- ─── 6. Valid code + fresh user → succeeds ───────────────────────────────────

RESET role;
SELECT is(
  (SELECT count(*)::int FROM
    (SELECT * FROM public.redeem_invite(
      'VALID001',
      '10000000-0000-0000-0000-000000000002'
    )) AS r),
  1, '6-1: valid code redeemed successfully'
);

-- Verify membership created
SELECT is(
  (SELECT count(*)::int FROM public.collection_members
   WHERE collection_id = 'd0000000-0000-0000-0000-000000000001'
     AND member_user_id = '10000000-0000-0000-0000-000000000002'),
  1, '6-2: membership created after redemption'
);

SELECT * FROM finish();

ROLLBACK;
