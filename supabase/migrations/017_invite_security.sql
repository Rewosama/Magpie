-- Migration 017: Invite code security hardening
--
-- Changes (gerekçelerle):
--
-- 1. invite_attempts table
--    Gerekçe: redeem_invite() için brute-force koruması. Kullanıcı başına
--    15 dakika içinde 5 başarısız denemeden sonra kilitlenir.
--
-- 2. redeem_invite() yeniden yazılıyor:
--    a) Atomik UPDATE: SELECT+UPDATE yerine tek UPDATE ... RETURNING kullanılır.
--       Gerekçe: FOR UPDATE SKIP LOCKED ikinci eş zamanlı isteği "bulunamadı"
--       gibi gösterebilir. Tek atomik UPDATE daha güvenilir.
--    b) Rate limiting: başarısız denemeler invite_attempts'e kaydedilir.
--    c) Mesaj normalizasyonu: NOT_FOUND, ALREADY_USED, EXPIRED hepsi INVALID
--       olarak döner. Gerekçe: farklı mesajlar kodun var olup olmadığını
--       sızdırır (oracle saldırısı).
--
-- 3. cleanup_expired_invites() fonksiyonu + invite_attempts temizliği
--    Gerekçe: invites tablosu ve attempts tablosu sonsuza kadar büyümemeli.

-- ── 1. invite_attempts tablosu ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_user_time
  ON invite_attempts (user_id, attempted_at);

-- RLS: kullanıcı kendi attempt'lerini göremez (no SELECT policy)
-- Tüm yazma işlemleri SECURITY DEFINER fonksiyon içinden yapılır.
ALTER TABLE invite_attempts ENABLE ROW LEVEL SECURITY;

-- ── 2. redeem_invite() — güvenlik sertleştirilmiş versiyon ───────────────────

DROP FUNCTION IF EXISTS redeem_invite(TEXT, UUID);

CREATE OR REPLACE FUNCTION redeem_invite(p_code TEXT, p_user_id UUID)
RETURNS TABLE (collection_id UUID, collection_name TEXT, member_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite   collection_invites%ROWTYPE;
  v_col_name TEXT;
  v_recent   INT;
BEGIN
  -- ── Rate limit check (5 başarısız deneme / 15 dakika) ──────────────────────
  SELECT COUNT(*) INTO v_recent
  FROM invite_attempts
  WHERE user_id = p_user_id
    AND attempted_at > now() - interval '15 minutes';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  -- ── Atomik UPDATE: tek işlemde hem doğrula hem kullan ─────────────────────
  -- NOT_FOUND, ALREADY_USED ve EXPIRED hepsi INVALID döner:
  -- farklı mesajlar kodun var olup olmadığını sızdırır.
  UPDATE collection_invites ci
  SET    used_at = now(),
         used_by = p_user_id
  WHERE  ci.code      = p_code
    AND  ci.used_at   IS NULL
    AND  ci.expires_at > now()
  RETURNING ci.* INTO v_invite;

  IF NOT FOUND THEN
    -- Başarısız denemeyi kaydet (rate limiting için)
    INSERT INTO invite_attempts (user_id) VALUES (p_user_id);
    -- Genel mesaj: var/yok/süresi dolmuş ayrımını sızdırma
    RAISE EXCEPTION 'INVALID';
  END IF;

  -- ── Sahip kendi koleksiyonuna üye olamaz ──────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = v_invite.collection_id AND c.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'IS_OWNER';
  END IF;

  -- ── Zaten üye ─────────────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM collection_members cm
    WHERE cm.collection_id = v_invite.collection_id
      AND cm.member_user_id = p_user_id
  ) THEN
    -- Rollback the used_at update since we won't create membership
    UPDATE collection_invites ci
    SET used_at = NULL, used_by = NULL
    WHERE ci.id = v_invite.id;
    RAISE EXCEPTION 'ALREADY_MEMBER';
  END IF;

  -- ── Üyelik oluştur ────────────────────────────────────────────────────────
  INSERT INTO collection_members (collection_id, member_user_id, member_role)
  VALUES (v_invite.collection_id, p_user_id, v_invite.grants_role);

  -- ── Koleksiyon adını döndür ───────────────────────────────────────────────
  SELECT c.name INTO v_col_name
  FROM collections c
  WHERE c.id = v_invite.collection_id;

  RETURN QUERY
  SELECT v_invite.collection_id, v_col_name, v_invite.grants_role;
END;
$$;

-- ── 3. Temizlik fonksiyonu ────────────────────────────────────────────────────
-- Süresi dolmuş/kullanılmış davetleri 30 gün sonra siler.
-- invite_attempts'i 1 saati geçenleri siler.
-- Döndürdüğü değer: silinen toplam satır sayısı.

CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invites INT;
  v_attempts INT;
BEGIN
  -- Eski invites
  WITH deleted AS (
    DELETE FROM collection_invites
    WHERE (expires_at < now() - interval '30 days')
       OR (used_at IS NOT NULL AND used_at < now() - interval '30 days')
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_invites FROM deleted;

  -- Eski attempts (1 saatten eski, rate limit için artık gerekmiyor)
  DELETE FROM invite_attempts
  WHERE attempted_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_attempts = ROW_COUNT;

  RETURN v_invites + v_attempts;
END;
$$;

-- ── Notlar ────────────────────────────────────────────────────────────────────
-- pg_cron ile haftalık otomatik temizlik (Supabase Pro'da mevcut):
--   SELECT cron.schedule('cleanup-invites', '0 3 * * 0',
--     $$SELECT cleanup_expired_invites()$$);
--
-- Free tier'da GitHub Actions workflow ile cleanup_expired_invites()
-- düzenli olarak çağrılabilir (supabase db execute ile).
