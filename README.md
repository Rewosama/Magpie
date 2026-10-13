<div align="center">
  <img src="web-viewer/public/logo-96.png" alt="Magpie" width="96" height="96" />

# Magpie

**Sosyal medya postlarını arşivleyen Chrome uzantısı ve web görüntüleyicisi.**

Instagram, X ve Threads'ten istediğin postları koleksiyonlarına sessizce kaydet,
web arayüzünden dilediğin zaman gözat. Paylaş, ortak çalış, yorum bırak.

🌐 **[magpie-archive.vercel.app](https://magpie-archive.vercel.app)** — Hemen dene!

[English](README-EN.md)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Postgres+Auth+RLS-3fcf8e?logo=supabase)
![Chrome MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285f4?logo=googlechrome&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?logo=pwa)


</div>

---

## İçindekiler

- [Özellikler](#özellikler)
- [Ekran Görüntüleri](#ekran-görüntüleri)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [Koleksiyon Türleri](#koleksiyon-türleri)
- [Geliştirme](#geliştirme)
- [Lisans](#lisans)
- [Destek](#destek)

---

## Özellikler

### Chrome Uzantısı

- **Instagram desteği** — feed, `/p/` postları, Reels, hikayeler
- **X / Twitter desteği** — tweetler, video thumbnail, alıntı tweet metni
- **Threads desteği** — postlar ve profil sayfaları
- **Tek tıkla kaydet** — gönderinin üzerinde beliren arşiv butonu
- **Varsayılan koleksiyon** — hızlı kaydetme, gerekirse koleksiyon değiştir
- **Akıllı metadata çıkarma** — caption, yazar, thumbnail (video frame dahil)
- **Tekrar kaydetme koruması** — aynı postu iki kez eklemez

### Web Görüntüleyici

- **Minimalist tasarım** — Linear/Raycast ilhamıyla ultra-minimal arayüz
- **PWA desteği** — ana ekrana ekle, mobilde uygulama gibi kullan
- **URL ile post ekleme** — uzantı olmadan da link yapıştırarak kaydet
- **Otomatik metadata çekme** — X postları için görsel ve metin otomatik alınır
- **Sonsuz kaydırma** — cursor tabanlı pagination
- **Tam metin arama** — caption, yazar ve notlarda arama
- **Platform filtreleme** — Instagram, X veya Threads'e göre filtrele
- **Koleksiyon yönetimi** — oluştur, yeniden adlandır, varsayılan belirle, sil
- **Toplu işlemler** — birden fazla postu seç ve sil
- **Karanlık mod** — sistem tercihine göre otomatik
- **Mobil uyumlu** — responsive tasarım, mobil sidebar

### Etiketler & Yorumlar

- **Etiket sistemi** — postlarına özel etiketler ekle
- **Etiket filtreleme** — kenar çubuğundan etikete tıkla
- **Yorum sistemi** — Facebook tarzı yorum alanı
  - 🔒 **Kişisel yorum** — sadece sen görürsün
  - 👥 **Paylaşılan yorum** — ortak koleksiyonda herkes görür
  - Birden fazla yorum ekleyebilirsin

### Paylaşım & İşbirliği

- **Paylaşımlı Koleksiyon** — davet koduyla sadece okuma erişimi ver
- **Ortak Koleksiyon** — post ekleyebilen, yorum yazabilen ortaklar davet et
- **Üye yönetimi** — istediğin zaman erişimi iptal et
- **RLS koruması** — tüm yetkiler veritabanı seviyesinde kontrol edilir

### PWA & Mobil

- **Ana ekrana ekle** — tarayıcıdan yükle, uygulama gibi aç
- **Share Target (Android)** — mobilde "Paylaş" menüsünden direkt kaydet
- **Offline hazır** — service worker ile temel önbellekleme
- **Mobil sidebar** — hamburger menü ile koleksiyon erişimi

---

## Ekran Görüntüleri

<div align="center">
  <i>Yakında eklenecek</i>
</div>

---

## Kurulum

### Ön Gereksinimler

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google Chrome

### 1. Supabase Projesi

```bash
supabase link --project-ref <proje-ref>
supabase db push
```

Dashboard → Settings → API'den anahtarları al.

### 2. Chrome Uzantısı

```bash
cd extension
cp .env.example .env
# .env dosyasını düzenle
npm install
npm run build
```

`chrome://extensions` → Geliştirici modu → Paketlenmemişi yükle → `extension/` klasörünü seç.

### 3. Web Görüntüleyici

```bash
cd web-viewer
cp .env.example .env.local
# .env.local dosyasını düzenle
npm install
npm run dev
```

---

## Kullanım

### Post Kaydetme (Uzantı)

1. Instagram, X veya Threads'te bir postun üzerine gel
2. Sağ üst köşede beliren **arşiv butonuna** tıkla
3. İlk kullanımda koleksiyon seçici açılır
4. Sonraki kaydetmelerde varsayılan koleksiyona gider

### Post Kaydetme (URL ile)

1. Web görüntüleyicisinde **URL İLE EKLE** butonuna tıkla
2. Instagram, X veya Threads post linkini yapıştır
3. Platform otomatik algılanır, koleksiyon seç
4. **Kaydet** — X postları için görsel ve metin otomatik çekilir

### Mobilde Kaydetme (Android)

1. Magpie'yi ana ekrana ekle (PWA olarak yükle)
2. Instagram veya X uygulamasında bir post aç
3. **Paylaş** → **Magpie** seç
4. Giriş yaptıysan direkt kaydedilir

### Web Görüntüleyici

| Eylem                | Nasıl                                     |
| -------------------- | ----------------------------------------- |
| Platform filtrele    | Üst bardaki platform sekmelerine tıkla    |
| Koleksiyona filtrele | Sol kenar çubuğundan koleksiyon seç       |
| Arama                | Üstteki arama çubuğunu kullan             |
| Koleksiyon değiştir  | Kart altındaki koleksiyon adına tıkla (▼) |
| Etiket ekle          | Kart üzerinde etiket ikonuna tıkla        |
| Yorum ekle           | Kart detayında yorum alanını kullan       |
| Toplu silme          | **Seç** → kartlara tıkla → **Sil**        |
| URL ile ekle         | **URL İLE EKLE** → link yapıştır          |

---

## Koleksiyon Türleri

| Tür            | Açıklama                                          |
| -------------- | ------------------------------------------------- |
| **Kişisel**    | Yalnızca sen görür ve düzenlersin                 |
| **Paylaşımlı** | Davet edilenler sadece okuyabilir                 |
| **Ortak**      | Davet edilenler post ekleyebilir, yorum yazabilir |

---

## Geliştirme

```bash
# Uzantı
cd extension && npm run build
cd extension && npm run watch

# Web görüntüleyici
cd web-viewer && npm run dev

# Test
cd extension && npm test
supabase test db
```

### Proje Yapısı

```
├── extension/           # Chrome uzantısı (MV3)
│   ├── background/      # Service worker
│   ├── content-scripts/ # Platform adaptörleri
│   ├── popup/           # Uzantı popup UI
│   └── shared/          # Paylaşılan tipler ve yardımcılar
│
├── web-viewer/          # Next.js web uygulaması
│   ├── app/             # App router sayfaları
│   ├── components/      # React bileşenleri
│   ├── lib/             # Yardımcı fonksiyonlar
│   └── public/          # Statik dosyalar (PWA manifest, SW)
│
└── supabase/            # Veritabanı migrasyonları ve testler
```

---

## Lisans

Copyright © 2025 Rewosama. Tüm hakları saklıdır.

Bu kaynak kodu yalnızca inceleme ve eğitim amaçlı paylaşılmaktadır.
İzin alınmadan kullanılamaz, kopyalanamaz, dağıtılamaz veya ticari amaçlarla kullanılamaz.

---

## Destek

Projeyi beğendiysen destek olabilirsin:

- 💜 [Bağış Yap](https://donate.bynogame.com/rewou)
- 💬 [Discord'a Katıl](https://discord.com/invite/qg6snV6skE)

---

<div align="center">
  <sub>Magpie — parlak şeyleri toplayan saksağan gibi, senin için toplar. 🐦‍⬛</sub>
</div>
