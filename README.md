<div align="center">
  <img src="web-viewer/app/icon-512.png" alt="Magpie" width="120" height="120" />

  # Magpie

  **Sosyal medya postlarını arşivleyen Chrome uzantısı ve web görüntüleyicisi.**
  Instagram ve X'ten istediğin postları koleksiyonlarına sessizce kaydet,
  web arayüzünden dilediğin zaman gözbat. Paylaş, ortak çalış.

  ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
  ![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
  ![Supabase](https://img.shields.io/badge/Supabase-Postgres+Auth+RLS-3fcf8e?logo=supabase)
  ![Chrome MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285f4?logo=googlechrome&logoColor=white)

</div>

---

## İçindekiler
- [Özellikler](#özellikler)
- [Mimari](#mimari)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [Koleksiyon Türleri](#koleksiyon-türleri)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Geliştirme](#geliştirme)
- [Test](#test)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Lisans](#lisans)

---

## Özellikler

### Chrome Uzantısı
- **Instagram desteği** — feed, `/p/` (dialog ve doğrudan URL), Reels, hikayeler
- **X / Twitter desteği** — tweetler, video poster thumbnail, alıntı tweet metni
- **Tek tıkla kaydet** — gönderinin üzerinde beliren arşiv butonu
- **Varsayılan koleksiyon** — doğrudan kaydeder, gerek yoksa picker'ı görmezsin
- **Akıllı metadata çıkarma** — caption, yazar, thumbnail (video frame dahil)
- **Tekrar kaydetme koruması** — canonical URL normalizasyonuyla aynı postu iki kez eklemez

### Web Görüntüleyici
- **Sonsuz kaydırma** — cursor tabanlı pagination (OFFSET yok, her sayfa O(log n))
- **Tam metin arama** — tsvector + GIN index, caption ve yazar adında ts_rank sıralaması
- **Arama vurgulaması** — eşleşen kelimeler kart üzerinde işaretlenir, 300ms debounce, URL'ye yansır
- **Koleksiyon yönetimi** — oluştur, yeniden adlandır, varsayılan belirle, sil
- **Toplu silme** — birden fazla postu seç ve tek seferde sil
- **Koleksiyon filtreleme** — sol kenar çubuğundan tek tıkla, aramayla birlikte çalışır
- **Karanlık mod** — sistem tercihin otomatik uygulanır

### Paylaşım & İşbirliği
- **Paylaşımlı Koleksiyon** — tek kullanımlık 24 saatlik davet kodu, sadece okuma erişimi
- **Ortak Koleksiyon** — post ekleyebilir, kendi postunu silebilir, yeni ortak davet edebilir
- **Erişim iptali** — istediğin zaman herhangi bir üyeyi kaldır
- **RLS koruması** — yetki kontrolleri Postgres RLS ile de uygulanır

---
## Mimari

```
+---------------------------+   +---------------------------+
|     Chrome Uzantısı       |   |    Web Görüntüleyici      |
|   (MV3 / TypeScript)      |   |   (Next.js 14 App)        |
|                           |   |                           |
|  content-scripts/         |   |  app/feed/page.tsx        |
|  +- instagram/            |   |  app/actions/             |
|  |  +- button-injector    |   |  +- posts.ts (getPosts)   |
|  |  +- metadata-extractor |   |  +- collections.ts        |
|  |  +- observer           |   |  +- sharing.ts            |
|  |  +- route-listener     |   |  +- members.ts            |
|  +- x.ts, modal.ts        |   |  components/              |
|  background/sw.ts         |   |  +- PostCardList.tsx      |
|  shared/                  |   |  +- PostCard.tsx          |
|  +- canonicalizeUrl.ts    |   |  +- SearchBar.tsx         |
|  +- invite-code.ts        |   |  lib/action-result.ts     |
+---------------------------+   +---------------------------+
              |                             |
              v                             v
+----------------------------------------------------------+
|                       Supabase                          |
|  Postgres DB           Auth          Storage            |
|  +- collections        +- Google     +- thumbnails/     |
|  +- saved_posts           OAuth                        |
|     (search_vector,    +- Email                        |
|      canonical_url)                                    |
|  +- collection_invites                                  |
|  +- collection_members                                  |
|  +- invite_attempts  (rate limit)                       |
|                                                         |
|  SECURITY DEFINER fonksiyonlar:                         |
|  +- redeem_invite()                                     |
|  +- get_shared_collections_with_owner()                 |
|  +- search_saved_posts()  (FTS + ts_rank)               |
+----------------------------------------------------------+
```

---

## Proje Yapısı

```
magpie/
+-- extension/                        Chrome Uzantısı (MV3)
|   +-- manifest.json
|   +-- build.mjs                     esbuild yapılandırması
|   +-- content-scripts/
|   |   +-- instagram/
|   |   |   +-- button-injector.ts
|   |   |   +-- metadata-extractor.ts
|   |   |   +-- observer.ts           MutationObserver (SPA)
|   |   |   +-- route-listener.ts, permalink.ts, storage.ts
|   |   +-- x.ts, modal.ts, toast.ts
|   +-- background/service-worker.ts
|   +-- popup/popup.ts
|   +-- shared/
|       +-- canonicalizeUrl.ts        Instagram/X URL normalizasyonu
|       +-- invite-code.ts            CSPRNG 8 haneli kod üretimi
|       +-- env.d.ts                  build-time process.env tipleri
|       +-- types/
|
+-- web-viewer/                       Next.js 14 Web Uygulaması
|   +-- app/
|   |   +-- feed/page.tsx             Cursor pagination + FTS
|   |   +-- actions/
|   |       +-- posts.ts              getPosts, deletePost, deletePosts
|   |       +-- collections.ts
|   |       +-- sharing.ts
|   |       +-- members.ts
|   |       +-- auth.ts
|   |       +-- index.ts              Barrel re-export
|   +-- components/
|   |   +-- PostCardList.tsx          IntersectionObserver infinite scroll
|   |   +-- PostCard.tsx              Arama vurgulaması
|   |   +-- SearchBar.tsx             300ms debounce, URL-sync
|   |   +-- CollectionFilter.tsx
|   |   +-- ShareModal.tsx, JoinCollectionModal.tsx, ManageMembersModal.tsx
|   +-- lib/
|       +-- supabase.ts
|       +-- types.ts                  FeedPost, PostCursor, Collection
|       +-- action-result.ts          ActionResult<T> discriminated union
|       +-- server-auth.ts            requireAuth() helper
|       +-- invite-code.ts
|
+-- supabase/
    +-- migrations/                   001 -> 020
    |   +-- 001_collections_table.sql
    |   +-- 002_saved_posts_table.sql
    |   +-- 003-004_rls_and_storage.sql
    |   +-- 005-006_is_default.sql
    |   +-- 007-009_collection_sharing.sql
    |   +-- 010-012_rls_fixes.sql
    |   +-- 013-016_members_and_storage.sql
    |   +-- 017_invite_rate_limiting.sql
    |   +-- 018_security_hardening.sql
    |   +-- 019_canonical_url.sql
    |   +-- 020_pagination_and_fts.sql
    +-- tests/
        +-- 01_rls_collections_and_posts.sql
        +-- 02_rls_invite_codes.sql
```

---
## Kurulum

### Ön Gereksinimler
- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`
- Google Chrome

### 1. Supabase Projesi
```bash
supabase link --project-ref <proje-ref>
supabase db push
```
Dashboard → Settings → API:
- **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` *(yalnızca sunucu tarafı)*

### 2. Chrome Uzantısı
```bash
cd extension
cp .env.example .env
npm install
npm run build
```
`chrome://extensions` → Geliştirici modu → Paketlenmemişi yükle → `extension/` seç.

### 3. Web Görüntüleyici
```bash
cd web-viewer
cp .env.example .env.local
npm install
npm run build   # production check
```

---

## Kullanım

### Uzantıyla Post Kaydetme
1. Instagram veya X'te bir postun üzerine gel.
2. Sağ üst köşede beliren **arşiv butonuna** tıkla.
3. İlk kullanımda koleksiyon seçici açılır.
4. Sonraki kaydetmelerde varsayılan koleksiyona doğrudan gider.
5. Toast'taki **"Değiştir"** linki ile koleksiyon değiştirilebilir.

### Web Görüntüleyicide Yönetim

| Eylem | Nasıl |
|---|---|
| Koleksiyon yeniden adlandır | Kenar çubuğunda üzerine gel → kalem ikonu |
| Varsayılan değiştir | Üzerine gel → yıldız ikonu |
| Post sil | Kartın üzerine gel → kırmızı çöp ikonu |
| Birden fazla sil | **Seç** → kartlara tıkla → **Sil** |
| Koleksiyona filtrele | Sol kenarda koleksiyon adına tıkla |
| Arama | Üstteki arama çubuğu (300ms debounce, URL'ye yansır) |
| Koleksiyon paylaş | Paylaş ikonu → kodu kopyala |
| Koleksiyona katıl | Kenar çubuğu altı → **Koleksiyona Katıl** |

---

## Koleksiyon Türleri

### Kişisel Koleksiyon
Yalnızca sahibi görür, ekler, siler.

### Paylaşımlı Koleksiyon (Görüntüleyici)
- Sahip tek kullanımlık 24 saatlik davet kodu üretir.
- Davet edilen kişi yalnızca **okuyabilir** — ekleyemez, silemez.
- Sahip herhangi bir üyeyi istediği zaman kaldırabilir.

### Ortak Koleksiyon (Collaborator)
- Sahip **"Ortak"** rolü seçip davet kodu üretir.
- Ortak üye: post ekleyebilir, yalnızca kendi eklediğini silebilir, yeni ortak davet edebilir.
- RLS politikaları bu kuralları veritabanı seviyesinde de uygular.

---
## Veritabanı Şeması

```sql
collections (id, user_id, name, is_default, created_at)

saved_posts (
  id, user_id, collection_id,
  post_url, canonical_url TEXT NOT NULL,   -- dedup (migration 019)
  post_type, platform,
  author_username, author_display_name, author_avatar_url,
  content_text, media_urls, thumbnail_url,
  post_timestamp, saved_at, raw_metadata,
  search_vector tsvector GENERATED ALWAYS AS (  -- GIN index (migration 020)
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(author_username, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(author_display_name, '')), 'B')
  ) STORED
)

collection_invites (id, collection_id, created_by, code CHAR(8) UNIQUE,
                    grants_role TEXT, expires_at, used_at, used_by)

invite_attempts (id, ip_hash, attempted_at)   -- rate limit

collection_members (id, collection_id, member_user_id,
                    member_role TEXT, joined_at)
```

### Önemli İndeksler

| İndeks | Amaç |
|---|---|
| `idx_sp_user_cursor (user_id, saved_at DESC, id DESC)` | Cursor pagination — koleksiyonsuz feed |
| `idx_sp_collection_cursor (collection_id, saved_at DESC, id DESC)` | Cursor pagination — koleksiyon filtreli |
| `idx_sp_search_vector` GIN | Full-text search |
| `uq_saved_posts_user_canonical` | Canonical URL dedup |

### RLS Politikaları

| Tablo | Erişim |
|---|---|
| `collections` | Sahip: tam · Üye: SELECT |
| `saved_posts` | Sahip: tam · viewer: SELECT · collaborator: SELECT + INSERT/DELETE (kendi) |
| `collection_invites` | Sahip: SELECT/INSERT · Herkese: tek kullanımlık redeem |
| `collection_members` | Üye: kendi · Sahip: koleksiyonundaki hepsi |

---

## Geliştirme

```bash
# Uzantı — derleme / izleme
cd extension && npm run build
cd extension && npm run watch

# Web görüntüleyici (geliştirme sunucusu)
cd web-viewer && npm start   # veya: next dev

# Tip denetimi
cd web-viewer && npx tsc --noEmit
cd extension && npm run typecheck

# Lint
cd web-viewer && npm run lint

# Yeni migration
supabase migration new <isim> && supabase db push
```

---

## Test

### Birim Testleri

```bash
cd extension && npm test             # permalink, canonicalize, metadata-extractor, invite-code
cd web-viewer && npm test            # invite-code
cd extension && npm run test:coverage
```

### RLS Entegrasyon Testleri (pgTAP + Docker)

```bash
supabase start
supabase test db
supabase stop
```

`supabase/tests/` altındaki dosyalar:
- `01_rls_collections_and_posts.sql` — sahip/viewer/collaborator/stranger senaryoları
- `02_rls_invite_codes.sql` — süresi dolmuş/kullanılmış kod, rate limit

---

## Ortam Değişkenleri

### `extension/.env`
| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'si |
| `SUPABASE_ANON_KEY` | Anonim (public) anahtar |
| `WEB_VIEWER_URL` | Web görüntüleyici URL'si |

### `web-viewer/.env.local`
| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'si |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonim (public) anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Servis rolü — **yalnızca sunucu tarafı** |

---

## Lisans

Copyright © 2026 Rewosama. Tüm hakları saklıdır.

Bu kaynak kodu yalnızca inceleme ve eğitim amaçlı paylaşılmaktadır.
İzin alınmadan kullanılamaz, kopyalanamaz, dağıtılamaz veya ticari amaçlarla kullanılamaz.

İzin talepleri için: rewound1201@gmail.com

---

<div align="center">
  <sub>Magpie — parlak şeyleri toplayan saksağan gibi, senin için toplar.</sub>
</div>
