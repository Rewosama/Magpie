<div align="center">
  <img src="web-viewer/public/logo-96.png" alt="Magpie" width="96" height="96" />

# Magpie

**A Chrome extension and web viewer for archiving social media posts.**

Silently save posts from Instagram, X, and Threads to your collections.
Browse them anytime on the web. Share, collaborate, and leave comments.

🌐 **[magpie-archive.vercel.app](https://magpie-archive.vercel.app)** — Try it now!

[Türkçe](README.md)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Postgres+Auth+RLS-3fcf8e?logo=supabase)
![Chrome MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285f4?logo=googlechrome&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?logo=pwa)

[![CI](https://github.com/Rewosama/Magpie/actions/workflows/ci.yml/badge.svg)](https://github.com/Rewosama/Magpie/actions/workflows/ci.yml)
[![Supabase RLS Tests](https://github.com/Rewosama/Magpie/actions/workflows/supabase.yml/badge.svg)](https://github.com/Rewosama/Magpie/actions/workflows/supabase.yml)

</div>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Collection Types](#collection-types)
- [Development](#development)
- [License](#license)
- [Support](#support)

---

## Features

### Chrome Extension

- **Instagram support** — feed, `/p/` posts, Reels, stories
- **X / Twitter support** — tweets, video thumbnails, quote tweet text
- **Threads support** — posts and profile pages
- **One-click save** — archive button appears on hover
- **Default collection** — quick save, change collection if needed
- **Smart metadata extraction** — caption, author, thumbnail (including video frames)
- **Duplicate protection** — won't save the same post twice

### Web Viewer

- **Minimalist design** — ultra-minimal UI inspired by Linear/Raycast
- **PWA support** — add to home screen, use like a native app
- **Add by URL** — save posts by pasting links, no extension needed
- **Auto metadata fetching** — images and text automatically fetched for X posts
- **Infinite scroll** — cursor-based pagination
- **Full-text search** — search in captions, authors, and notes
- **Platform filtering** — filter by Instagram, X, or Threads
- **Collection management** — create, rename, set default, delete
- **Bulk operations** — select multiple posts and delete
- **Dark mode** — automatic based on system preference
- **Mobile friendly** — responsive design, mobile sidebar

### Tags & Comments

- **Tag system** — add custom tags to your posts
- **Tag filtering** — click a tag in the sidebar to filter
- **Comment system** — Facebook-style comment area
  - 🔒 **Private comment** — only you can see
  - 👥 **Shared comment** — visible to all collaborators
  - Add multiple comments per post

### Sharing & Collaboration

- **Shared Collection** — give read-only access with invite code
- **Collaborative Collection** — invite collaborators who can add posts and comments
- **Member management** — revoke access anytime
- **RLS protection** — all permissions enforced at database level

### PWA & Mobile

- **Add to home screen** — install from browser, open like an app
- **Share Target (Android)** — save directly from the Share menu on mobile
- **Offline ready** — basic caching with service worker
- **Mobile sidebar** — hamburger menu for collection access

---

## Screenshots

<div align="center">
  <i>Coming soon</i>
</div>

---

## Installation

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google Chrome

### 1. Supabase Project

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Get your keys from Dashboard → Settings → API.

### 2. Chrome Extension

```bash
cd extension
cp .env.example .env
# Edit .env file
npm install
npm run build
```

`chrome://extensions` → Developer mode → Load unpacked → Select `extension/` folder.

### 3. Web Viewer

```bash
cd web-viewer
cp .env.example .env.local
# Edit .env.local file
npm install
npm run dev
```

---

## Usage

### Saving Posts (Extension)

1. Hover over a post on Instagram, X, or Threads
2. Click the **archive button** that appears in the top-right corner
3. On first use, the collection picker opens
4. Subsequent saves go directly to the default collection

### Saving Posts (by URL)

1. Click the **ADD BY URL** button in the web viewer
2. Paste an Instagram, X, or Threads post link
3. Platform is auto-detected, select a collection
4. **Save** — images and text are automatically fetched for X posts

### Saving on Mobile (Android)

1. Add Magpie to home screen (install as PWA)
2. Open a post in Instagram or X app
3. **Share** → Select **Magpie**
4. If logged in, it saves directly

### Web Viewer

| Action               | How                                          |
| -------------------- | -------------------------------------------- |
| Filter by platform   | Click platform tabs in the top bar           |
| Filter by collection | Select collection from sidebar               |
| Search               | Use the search bar at the top                |
| Change collection    | Click the collection name (▼) below the card |
| Add tag              | Click the tag icon on the card               |
| Add comment          | Use the comment section in card details      |
| Bulk delete          | **Select** → click cards → **Delete**        |
| Add by URL           | **ADD BY URL** → paste link                  |

---

## Collection Types

| Type              | Description                         |
| ----------------- | ----------------------------------- |
| **Personal**      | Only you can view and edit          |
| **Shared**        | Invitees can only view              |
| **Collaborative** | Invitees can add posts and comments |

---

## Development

```bash
# Extension
cd extension && npm run build
cd extension && npm run watch

# Web viewer
cd web-viewer && npm run dev

# Tests
cd extension && npm test
supabase test db
```

### Project Structure

```
├── extension/           # Chrome extension (MV3)
│   ├── background/      # Service worker
│   ├── content-scripts/ # Platform adapters
│   ├── popup/           # Extension popup UI
│   └── shared/          # Shared types and helpers
│
├── web-viewer/          # Next.js web application
│   ├── app/             # App router pages
│   ├── components/      # React components
│   ├── lib/             # Helper functions
│   └── public/          # Static files (PWA manifest, SW)
│
└── supabase/            # Database migrations and tests
```

---

## License

Copyright © 2025 Rewosama. All rights reserved.

This source code is shared for review and educational purposes only.
It may not be used, copied, distributed, or used for commercial purposes without permission.

---

## Support

If you like this project, you can support it:

- 💜 [Donate](https://donate.bynogame.com/rewou)
- 💬 [Join Discord](https://discord.com/invite/qg6snV6skE)

---

<div align="center">
  <sub>Magpie — like the bird that collects shiny things, it collects for you. 🐦‍⬛</sub>
</div>
