# Magpie Design System

## Genel Bakış

Magpie, **ultra-minimalist**, **monospace-first** bir tasarım diline sahip kişisel sosyal medya arşiv uygulamasıdır. Tasarım felsefesi Linear, Raycast ve Vercel'den ilham alır: keskin köşeler, yüksek kontrast, tipografik hiyerarşi ve gereksiz süslemelerden arındırılmış sade bir arayüz.

---

## Renk Paleti

### Light Mode
| Kullanım | Renk | Tailwind Class |
|----------|------|----------------|
| Arka plan | `#fafafa` | `bg-zinc-50` |
| Kart/Modal arka planı | `#ffffff` | `bg-white` |
| Ana metin | `#18181b` | `text-zinc-900` |
| İkincil metin | `#71717a` | `text-zinc-500` |
| Soluk metin | `#a1a1aa` | `text-zinc-400` |
| Border | `#e4e4e7` | `border-zinc-200` |
| Hover arka plan | `#f4f4f5` | `hover:bg-zinc-100` |

### Dark Mode
| Kullanım | Renk | Tailwind Class |
|----------|------|----------------|
| Arka plan | `#09090b` | `dark:bg-zinc-950` |
| Kart/Modal arka planı | `#18181b` | `dark:bg-zinc-900` |
| Ana metin | `#fafafa` | `dark:text-zinc-100` |
| İkincil metin | `#a1a1aa` | `dark:text-zinc-400` |
| Soluk metin | `#71717a` | `dark:text-zinc-500` |
| Border | `#27272a` | `dark:border-zinc-800` |
| Hover arka plan | `#18181b` | `dark:hover:bg-zinc-900` |

### Aksan Renkler
- **Başarı**: `text-emerald-500`
- **Hata**: `text-red-500`
- **Uyarı**: `text-amber-500`

---

## Tipografi

### Font
- **Birincil**: JetBrains Mono (monospace)
- **Fallback**: SF Mono, Fira Code, Consolas, monospace

### Stil Kuralları
- **Başlıklar**: `UPPERCASE`, letter-spacing `0.15em`
- **Etiketler**: `UPPERCASE`, `text-[10px]` veya `text-[11px]`
- **Body text**: Normal case, `text-sm` (14px)
- **Mono class**: `.mono` - tüm monospace metin için

### Örnekler
```css
/* Sidebar başlık */
.sidebar-header {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: zinc-400;
}

/* Platform tab */
.platform-tab {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

---

## Şekil Dili

### Köşeler
- **Tüm elemanlar**: `border-radius: 0` (keskin köşe)
- **Tek istisna**: Avatar'lar `border-radius: 9999px` (tam yuvarlak)

```css
/* Global kural */
* {
  border-radius: 0 !important;
}

.avatar-circle {
  border-radius: 9999px !important;
}
```

### Border'lar
- **Kalınlık**: 1px
- **Stil**: Solid
- **Renk**: `zinc-200` (light) / `zinc-800` (dark)

---

## Bileşenler

### Butonlar

#### Primary Button
```html
<button class="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
  KAYDET
</button>
```

#### Minimal Button
```html
<button class="px-3 py-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
  İptal
</button>
```

#### Danger Button
```html
<button class="px-3 py-1.5 bg-red-500 text-white text-sm hover:bg-red-600 transition-colors">
  SİL
</button>
```

#### Dashed Button (Ekle/Katıl)
```html
<button class="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
  + KOLEKSİYONA KATIL
</button>
```

### Input Alanları
```html
<input class="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600" />
```

### Kartlar (Post Card)
```html
<div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden group">
  <!-- Thumbnail: aspect-square -->
  <div class="aspect-square bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
    <img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
  </div>
  
  <!-- Content -->
  <div class="p-3 space-y-2">
    <p class="text-xs text-zinc-500">@username</p>
    <p class="text-sm line-clamp-2">Post içeriği...</p>
  </div>
</div>
```

### Modal
```html
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <!-- Backdrop -->
  <div class="absolute inset-0 bg-black/60" />
  
  <!-- Content -->
  <div class="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
      <span class="mono uppercase tracking-wider">Başlık</span>
      <button>×</button>
    </div>
    
    <!-- Body -->
    <div class="py-4">...</div>
  </div>
</div>
```

---

## Layout

### Header
- **Yükseklik**: 48px (`h-12`)
- **Yapı**: Logo (sol) | Search (orta) | Ayarlar + Çıkış (sağ)
- **Konum**: Sticky (`sticky top-0 z-40`)
- **Border**: Alt kenarda 1px

```
┌──────────────────────────────────────────────────────────────┐
│  🐦 MAGPIE ARCHIVE    │    [  Ara...  ⌘K  ]    │  ⚙️  🚪    │
└──────────────────────────────────────────────────────────────┘
```

### Sidebar
- **Genişlik**: 192px (`w-48`)
- **İçerik**: Koleksiyonlar, Etiketler, Destek/Discord linkleri
- **Konum**: Sol tarafta sticky

### Ana Grid
- **Responsive columns**: 
  - Mobile: 2 sütun
  - SM: 3 sütun
  - LG: 4 sütun
  - XL: 5 sütun
- **Gap**: 16px (`gap-4`)

```
┌─────────┬────────────────────────────────────────────────────┐
│         │  [TÜMÜ] [INSTAGRAM] [X]              [□ SEÇ]       │
│ Koleks. ├────────────────────────────────────────────────────┤
│ ────────│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│ Tümü    │  │    │ │    │ │    │ │    │ │    │               │
│ ★ Saved │  │    │ │    │ │    │ │    │ │    │               │
│   Work  │  └────┘ └────┘ └────┘ └────┘ └────┘               │
│         │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│ Etiket. │  │    │ │    │ │    │ │    │ │    │               │
│ ────────│  │    │ │    │ │    │ │    │ │    │               │
│ #design │  └────┘ └────┘ └────┘ └────┘ └────┘               │
│ #code   │                                                    │
│         ├────────────────────────────────────────────────────┤
│ [Destek]│                                                    │
│[Discord]│                                                    │
└─────────┴────────────────────────────────────────────────────┘
```

---

## Özel Sayfalar

### Login Sayfası
- Tam ekran ortalanmış
- Logo (64x64, %80 opacity)
- Başlık: "MAGPIE ARCHIVE"
- Alt başlık: "Kişisel sosyal medya arşivin"
- Google ile giriş butonu
- Header yok

### 404 Sayfası
- Tam ekran ortalanmış
- Logo (48x48, %60 opacity)
- Büyük "404" yazısı (text-7xl, çok soluk)
- "Sayfa Bulunamadı" mesajı
- Auth durumuna göre buton: "Arşive Dön" veya "Giriş Yap"
- Header yok

### Auth Callback
- Tam ekran overlay (z-9999)
- Spinner + durum mesajı
- Başarı: ✓ yeşil ikon
- Hata: ✗ kırmızı ikon

---

## Animasyonlar

### Geçişler
- **Renk/Opacity**: `transition-colors`, 150ms
- **Transform**: `transition-transform`, 300ms
- **Tümü**: `transition-all`, 200ms

### Hover Efektleri
- Kartlarda hafif zoom: `group-hover:scale-[1.02]`
- Butonlarda renk değişimi
- İkonlarda opacity artışı

### Loading States
- Spinner: `animate-spin`
- Pulse: `animate-pulse`
- Skeleton: Zinc-100/900 arka plan

---

## İkonlar

- **Stil**: Outline (stroke-based)
- **Stroke width**: 1.5px
- **Boyutlar**: 
  - Küçük: `w-3 h-3`
  - Normal: `w-4 h-4`
  - Büyük: `w-5 h-5`
- **Kaynak**: Custom SVG (Lucide/Feather benzeri)

### Platform İkonları
- Instagram: Kamera outline
- X (Twitter): Stilize X harfi
- Threads: @ işareti

---

## Responsive Davranış

| Breakpoint | Genişlik | Grid Sütun | Sidebar |
|------------|----------|------------|---------|
| Default | < 640px | 2 | Gizli |
| SM | 640px+ | 3 | Gizli |
| MD | 768px+ | 3 | Görünür |
| LG | 1024px+ | 4 | Görünür |
| XL | 1280px+ | 5 | Görünür |

---

## Dark Mode

- **Tetikleme**: `localStorage.getItem('magpie-theme')` veya sistem tercihi
- **Class**: `<html class="dark">`
- **Uygulama**: Tailwind `dark:` prefix'i ile

```javascript
// Tema script (layout'ta inline)
try {
  const t = localStorage.getItem('magpie-theme');
  const p = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (t === 'dark' || (!t && p)) document.documentElement.classList.add('dark');
} catch(e) {}
```

---

## Özet: Tasarım İlkeleri

1. **Keskin köşeler** - Yuvarlak köşe yok (avatar hariç)
2. **Monospace tipografi** - JetBrains Mono her yerde
3. **Uppercase etiketler** - Başlıklar ve kategoriler
4. **Yüksek kontrast** - Siyah/beyaz dominant
5. **Minimal süsleme** - Gölge yok, gradient yok
6. **İnce border'lar** - 1px, zinc tonları
7. **Fonksiyonel animasyonlar** - Sadece gerekli yerlerde
8. **Dark mode native** - Tam karanlık tema desteği
