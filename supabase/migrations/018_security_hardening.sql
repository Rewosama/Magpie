-- Migration 018: Security hardening (full audit pass)
--
-- Fixes addressed:
--   K1  saved_posts_owner WITH CHECK koleksiyon sahipliğini doğrulamıyordu
--   K2  SECURITY DEFINER fonksiyonlar PUBLIC'e açıktı (anon dahil)
--   O1  redeem_invite, p_user_id'yi auth.uid() ile doğrulamıyordu
--   O3  cleanup_expired_invites herkese açıktı
--   D1  SET search_path = '' ve public. prefix (search_path injection koruması)
--   D2  invite_attempts için explicit policy notu

-- ============================================================================
-- K1: saved_posts_owner WITH CHECK — koleksiyon sahipliği kontrolü ekle
-- ============================================================================
-- Eski politika yalnızca user_id = auth.uid() kontrol ediyordu.
-- Bu, herhangi bir authenticated kullanıcının UUID'sini bildiği herhangi
-- bir koleksiyona kendi user_id'siyle post eklemesine izin veriyordu.
-- Düzeltme: is_collection_owner() ile sahiplik ek koşul olarak eklendi.
-- Collaborator INSERT için ayrı politika (saved_posts_collaborator_insert) hâlâ geçerli.

DROP POLICY IF EXISTS saved_posts_owner ON saved_posts;

CREATE POLICY saved_posts_owner ON saved_posts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      collection_id IS NULL                         -- koleksiyonsuz kayıt izinli
      OR is_collection_owner(collection_id)         -- kendi koleksiyonuna kayıt
      -- collaborator inserts: handled by saved_posts_collaborator_insert policy
    )
  );

-- ============================================================================
-- D1 + K2 + O1: Tüm SECURITY DEFINER fonksiyonları yeniden yaz
--   - SET search_path = '' (önceki: SET search_path = public)
--   - Tüm tablo referanslarına public. prefix
--   - REVOKE EXECUTE FROM PUBLIC; GRANT TO authenticated
--   - redeem_invite: auth.uid() <> p_user_id kontrolü eklendi
-- ============================================================================

-- ── is_collection_owner ──────────────────────────────────────────────────────
-- CASCADE drops dependent policies; they are recreated below.
DROP FUNCTION IF EXISTS is_collection_owner(UUID) CASCADE;

CREATE OR REPLACE FUNCTION is_collection_owner(p_collection_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = p_collection_id
      AND user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION is_collection_owner(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION is_collection_owner(UUID) TO authenticated;

-- Recreate policies that were dropped by CASCADE above
CREATE POLICY cm_owner_select ON public.collection_members
  FOR SELECT USING (is_collection_owner(collection_id));

CREATE POLICY cm_owner_delete ON public.collection_members
  FOR DELETE USING (is_collection_owner(collection_id));

CREATE POLICY ci_owner_delete ON public.collection_invites
  FOR DELETE USING (is_collection_owner(collection_id));

-- ── redeem_invite ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS redeem_invite(TEXT, UUID);

CREATE OR REPLACE FUNCTION redeem_invite(p_code TEXT, p_user_id UUID)
RETURNS TABLE (collection_id UUID, collection_name TEXT, member_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite   public.collection_invites%ROWTYPE;
  v_col_name TEXT;
  v_recent   INT;
BEGIN
  -- O1: caller must be who they claim to be
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Rate limit: 5 başarısız deneme / 15 dakika
  SELECT COUNT(*) INTO v_recent
  FROM public.invite_attempts
  WHERE user_id = p_user_id
    AND attempted_at > now() - interval '15 minutes';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  -- Atomik UPDATE — NOT_FOUND/ALREADY_USED/EXPIRED hepsi INVALID döner
  UPDATE public.collection_invites ci
  SET    used_at = now(),
         used_by = p_user_id
  WHERE  ci.code      = p_code
    AND  ci.used_at   IS NULL
    AND  ci.expires_at > now()
  RETURNING ci.* INTO v_invite;

  IF NOT FOUND THEN
    INSERT INTO public.invite_attempts (user_id) VALUES (p_user_id);
    RAISE EXCEPTION 'INVALID';
  END IF;

  -- Sahip kendi koleksiyonuna üye olamaz
  IF EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = v_invite.collection_id AND c.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'IS_OWNER';
  END IF;

  -- Zaten üye
  IF EXISTS (
    SELECT 1 FROM public.collection_members cm
    WHERE cm.collection_id = v_invite.collection_id
      AND cm.member_user_id = p_user_id
  ) THEN
    UPDATE public.collection_invites ci
    SET used_at = NULL, used_by = NULL
    WHERE ci.id = v_invite.id;
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  -- Üyelik oluştur
  INSERT INTO public.collection_members (collection_id, member_user_id, member_role)
  VALUES (v_invite.collection_id, p_user_id, v_invite.grants_role);

  SELECT c.name INTO v_col_name
  FROM public.collections c
  WHERE c.id = v_invite.collection_id;

  RETURN QUERY
  SELECT v_invite.collection_id, v_col_name, v_invite.grants_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION redeem_invite(TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION redeem_invite(TEXT, UUID) TO authenticated;

-- ── get_members_with_email ───────────────────────────────────────────────────
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
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    c.user_id,
    u.email::TEXT,
    c.created_at,
    NULL::TEXT,
    TRUE,
    'owner'::TEXT
  FROM public.collections c
  JOIN auth.users u ON u.id = c.user_id
  WHERE c.id = p_collection_id;

  RETURN QUERY
  SELECT
    cm.member_user_id,
    u.email::TEXT,
    cm.joined_at,
    ci.code::TEXT,
    FALSE,
    cm.member_role
  FROM public.collection_members cm
  JOIN auth.users u ON u.id = cm.member_user_id
  LEFT JOIN public.collection_invites ci
    ON ci.used_by = cm.member_user_id
   AND ci.collection_id = cm.collection_id
  WHERE cm.collection_id = p_collection_id
  ORDER BY cm.joined_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_members_with_email(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_members_with_email(UUID) TO authenticated;

-- ── get_shared_collections_with_owner ────────────────────────────────────────
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
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT cm.collection_id, c.name, u.email::TEXT, cm.joined_at, cm.member_role
  FROM public.collection_members cm
  JOIN public.collections c ON c.id = cm.collection_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE cm.member_user_id = p_user_id
  ORDER BY cm.joined_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_shared_collections_with_owner(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_shared_collections_with_owner(UUID) TO authenticated;

-- ── get_active_invites ───────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_active_invites(UUID);

CREATE OR REPLACE FUNCTION get_active_invites(p_collection_id UUID)
RETURNS TABLE (
  invite_id     UUID,
  code          CHAR(8),
  grants_role   TEXT,
  expires_at    TIMESTAMPTZ,
  created_by    UUID,
  creator_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.collections
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
  FROM public.collection_invites ci
  JOIN auth.users u ON u.id = ci.created_by
  WHERE ci.collection_id = p_collection_id
    AND ci.used_at IS NULL
    AND ci.expires_at > now()
  ORDER BY ci.expires_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_active_invites(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_active_invites(UUID) TO authenticated;

-- ── cleanup_expired_invites ──────────────────────────────────────────────────
-- O3: sadece service_role çağırabilir (background job)
DROP FUNCTION IF EXISTS cleanup_expired_invites();

CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invites  INT;
  v_attempts INT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.collection_invites
    WHERE (expires_at < now() - interval '30 days')
       OR (used_at IS NOT NULL AND used_at < now() - interval '30 days')
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_invites FROM deleted;

  DELETE FROM public.invite_attempts
  WHERE attempted_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_attempts = ROW_COUNT;

  RETURN v_invites + v_attempts;
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_expired_invites() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_expired_invites() FROM authenticated;
GRANT  EXECUTE ON FUNCTION cleanup_expired_invites() TO service_role;

-- ============================================================================
-- D2: invite_attempts — explicit note (RLS açık, policy yok = implicit deny)
-- ============================================================================
-- invite_attempts tablosunda SELECT/INSERT/UPDATE/DELETE politikası yoktur.
-- RLS açık olduğu için "no matching policy = denied" kuralı geçerlidir.
-- Tüm yazma işlemleri SECURITY DEFINER redeem_invite() üzerinden yapılır.
-- Explicit DENY policy gerekmez; mevcut durum doğrudur.

-- ============================================================================
-- NOT: O2 (thumbnails_public_read) — intentional, değiştirilmedi
-- ============================================================================
-- Thumbnail'ler public bucket'ta saklanıyor (tasarımsal karar).
-- Değiştirmek için: bucket'ı private yap, signed URL oluştur, frontend güncelle.
-- Bu migration'da kapsam dışı bırakıldı.
