# Adding a New Platform to Magpie

This guide explains how to add support for a new social media platform to the Magpie browser extension.

## Architecture Overview

Magpie uses a **platform adapter pattern** where:

- **Shared Core** (`shared/core/`) handles common logic: MutationObserver, route listening, save flow, toast/modal display
- **Platform Adapters** (`content-scripts/adapters/<platform>/`) implement platform-specific DOM selectors, metadata extraction, and button injection

Each platform implements the `PlatformAdapter` interface defined in `shared/platform.ts`.

## Step-by-Step Guide

### 1. Create the Adapter Directory

```
extension/content-scripts/adapters/<platform>/
├── adapter.ts        # Main adapter class
├── selectors.ts      # DOM selectors and constants
├── url-utils.ts      # URL normalization
├── metadata.ts       # Metadata extraction from DOM
└── button-injection.ts  # Button injection logic
```

### 2. Define Selectors (`selectors.ts`)

Identify the DOM structure of posts on the platform:

```typescript
// selectors.ts

// Post container selector
export const POST_SELECTOR = 'article[data-post]';

// Selectors within a post
export const WITHIN_POST = {
  authorLink: 'a[href^="/@"]',
  postText: 'div[data-text]',
  postLink: 'a[href*="/post/"]',
  timestamp: 'time[datetime]',
  photo: 'img[data-image]',
  video: 'video',
  actionBar: 'div[role="group"]',
} as const;

// URL patterns
export const PLATFORM_ORIGIN = "https://www.example.com";
export const PLATFORM_HOSTS = new Set(["www.example.com", "example.com"]);
export const POST_ID_RE = /^[A-Za-z0-9_-]+$/;

// Button positioning (aria-labels in multiple languages)
export const LIKE_LABELS = ["Like", "Beğen"];
export const SHARE_LABELS = ["Share", "Paylaş"];
```

**Tips for finding selectors:**

- Use browser DevTools (F12 → Elements)
- Look for `data-testid` or `data-*` attributes (more stable than class names)
- Prefer `role` attributes when available
- Test selectors in the console: `document.querySelectorAll('your-selector')`

### 3. Implement URL Utilities (`url-utils.ts`)

```typescript
// url-utils.ts
import type { NormalizedPostLink } from "../../../shared/platform";
import { PLATFORM_ORIGIN, PLATFORM_HOSTS, POST_ID_RE } from "./selectors";

export function canonicalizePlatformUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!PLATFORM_HOSTS.has(url.hostname)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  
  // Extract post ID based on URL pattern
  // Example: /@username/post/{postId}
  const postIdx = parts.indexOf("post");
  if (postIdx >= 0 && parts[postIdx + 1]) {
    const postId = parts[postIdx + 1];
    if (POST_ID_RE.test(postId)) {
      return `${PLATFORM_ORIGIN}/post/${postId}`;
    }
  }

  return null;
}

export function normalizePlatformUrl(rawUrl: string): NormalizedPostLink | null {
  const canonical = canonicalizePlatformUrl(rawUrl);
  if (!canonical) return null;

  const match = canonical.match(/\/post\/([A-Za-z0-9_-]+)/);
  if (!match) return null;

  return {
    id: match[1],
    canonicalUrl: canonical,
    postType: "post", // or "reel", "story", etc.
  };
}
```

### 4. Implement Metadata Extraction (`metadata.ts`)

```typescript
// metadata.ts
import type { PostMetadata } from "../../../shared/types/domain";
import type { NormalizedPostLink } from "../../../shared/platform";
import { WITHIN_POST } from "./selectors";

export function extractPlatformMetadata(
  el: Element,
  _link: NormalizedPostLink
): Partial<PostMetadata> {
  // Author
  const authorLink = el.querySelector<HTMLAnchorElement>(WITHIN_POST.authorLink);
  const author_username = authorLink?.getAttribute("href")?.replace("/@", "").split("/")[0] ?? null;

  // Content
  const textEl = el.querySelector<HTMLElement>(WITHIN_POST.postText);
  const content_text = textEl?.textContent?.trim() ?? null;

  // Timestamp
  const timeEl = el.querySelector<HTMLTimeElement>(WITHIN_POST.timestamp);
  const post_timestamp = timeEl?.getAttribute("datetime") ?? null;

  // Media
  const media_urls: string[] = [];
  
  // Images
  el.querySelectorAll<HTMLImageElement>(WITHIN_POST.photo).forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src && !src.startsWith("data:")) media_urls.push(src);
  });

  // Video posters
  el.querySelectorAll<HTMLVideoElement>("video[poster]").forEach((video) => {
    const poster = video.getAttribute("poster");
    if (poster) media_urls.push(poster);
  });

  return {
    author_username,
    author_display_name: null,
    author_avatar_url: null,
    content_text,
    media_urls,
    post_timestamp,
  };
}
```

### 5. Implement Button Injection (`button-injection.ts`)

```typescript
// button-injection.ts
import {
  BUTTON_ATTR,
  BUTTON_SELECTOR,
  getButtonIcon,
  type ButtonState,
} from "../../../shared/platform";
import { LIKE_LABELS, SHARE_LABELS, WITHIN_POST } from "./selectors";

export function setButtonState(btn: HTMLButtonElement, state: ButtonState): void {
  btn.innerHTML = getButtonIcon(state);
  btn.disabled = state === "loading";
  btn.setAttribute("data-state", state);
}

function createSaveButton(onClick: (e: MouseEvent) => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.setAttribute(BUTTON_ATTR, "true");
  btn.setAttribute("aria-label", "Save to Magpie");
  btn.setAttribute("type", "button");
  btn.innerHTML = getButtonIcon("idle");

  // Style to match platform UI
  btn.style.cssText = [
    "background:none",
    "border:none",
    "cursor:pointer",
    "padding:8px",
    "display:inline-flex",
    "align-items:center",
    "opacity:0.7",
  ].join(";");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick(e);
  });

  return btn;
}

function findActionBar(postElement: Element): Element | null {
  // Find the container with Like/Share buttons
  const actionBar = postElement.querySelector(WITHIN_POST.actionBar);
  if (actionBar) return actionBar;

  // Fallback: search for buttons by aria-label
  const allLabels = [...LIKE_LABELS, ...SHARE_LABELS];
  for (const label of allLabels) {
    const svg = postElement.querySelector(`svg[aria-label="${label}"]`);
    if (svg) {
      const container = svg.closest('div[role="group"]');
      if (container) return container;
    }
  }
  return null;
}

export function injectPlatformButton(
  postElement: Element,
  onClick: (postElement: Element, button: HTMLButtonElement) => void
): HTMLButtonElement | null {
  if (postElement.querySelector(BUTTON_SELECTOR)) return null;

  const actionBar = findActionBar(postElement);
  if (!actionBar) return null;

  const handleClick = (e: MouseEvent) => {
    const btn = e.currentTarget as HTMLButtonElement;
    onClick(postElement, btn);
  };

  const btn = createSaveButton(handleClick);
  actionBar.appendChild(btn);
  return btn;
}

export function hasPlatformButton(element: Element): boolean {
  return element.querySelector(BUTTON_SELECTOR) !== null;
}

export function removePlatformButtons(): void {
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => btn.remove());
}
```

### 6. Create the Main Adapter (`adapter.ts`)

```typescript
// adapter.ts
import type { PlatformAdapter, NormalizedPostLink, SourceContext } from "../../../shared/platform";
import type { PostMetadata } from "../../../shared/types/domain";
import { normalizePlatformUrl, canonicalizePlatformUrl } from "./url-utils";
import { extractPlatformMetadata } from "./metadata";
import { injectPlatformButton, hasPlatformButton, removePlatformButtons } from "./button-injection";
import { POST_SELECTOR, WITHIN_POST } from "./selectors";

export class PlatformAdapter implements PlatformAdapter {
  readonly id = "platform-name"; // e.g., "threads", "reddit"
  readonly hostMatches = ["https://www.example.com/*"] as const;

  findPostElements(root: Element | Document): Element[] {
    const results: Element[] = [];
    root.querySelectorAll(POST_SELECTOR).forEach((post) => {
      if (post.querySelector(WITHIN_POST.postLink)) {
        results.push(post);
      }
    });
    return results;
  }

  getPostUrl(postElement: Element): NormalizedPostLink | null {
    const link = postElement.querySelector<HTMLAnchorElement>(WITHIN_POST.postLink);
    if (link?.href) {
      return normalizePlatformUrl(link.href);
    }
    if (this.detectSourceContext() === "post-page") {
      return normalizePlatformUrl(window.location.href);
    }
    return null;
  }

  extractMetadata(postElement: Element, link: NormalizedPostLink): Partial<PostMetadata> {
    return extractPlatformMetadata(postElement, link);
  }

  injectButton(
    postElement: Element,
    onClick: (postElement: Element, button: HTMLButtonElement) => void
  ): HTMLButtonElement | null {
    return injectPlatformButton(postElement, onClick);
  }

  hasButton(postElement: Element): boolean {
    return hasPlatformButton(postElement);
  }

  removeStaleButtons(): void {
    removePlatformButtons();
  }

  canonicalizeUrl(rawUrl: string): string | null {
    return canonicalizePlatformUrl(rawUrl);
  }

  detectSourceContext(): SourceContext {
    const path = window.location.pathname;
    if (path === "/" || path === "") return "feed";
    if (/\/post\//.test(path)) return "post-page";
    if (/^\/@[^/]+\/?$/.test(path)) return "profile";
    return "unknown";
  }

  findPostRoot(button: Element): Element | null {
    return button.closest(POST_SELECTOR);
  }
}
```

### 7. Create the Entry Point

```typescript
// content-scripts/platform-entry.ts
import { PlatformAdapter } from "./adapters/platform/adapter";
import { startPlatformCore } from "../shared/core";

function initialize(): void {
  const adapter = new PlatformAdapter();
  startPlatformCore(adapter);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
```

### 8. Update Build Configuration (`build.mjs`)

Add the new entry point to the `entries` array:

```javascript
const entries = [
  // ... existing entries ...
  {
    in: 'content-scripts/platform-entry.ts',
    out: 'dist/content-scripts/platform.js',
    format: 'iife',
  },
];
```

### 9. Update Manifest (`manifest.json`)

Add host permissions and content script configuration:

```json
{
  "host_permissions": [
    "https://www.example.com/*",
    // ... existing permissions
  ],
  "content_scripts": [
    {
      "matches": ["https://www.example.com/*"],
      "js": ["dist/content-scripts/platform.js"],
      "css": ["dist/styles/toast.css"],
      "run_at": "document_idle"
    }
    // ... existing content scripts
  ],
  "web_accessible_resources": [
    {
      "resources": ["dist/styles/toast.css", ...],
      "matches": [
        "https://www.example.com/*",
        // ... existing matches
      ]
    }
  ]
}
```

### 10. Add Toast Styling (Optional)

If the platform has a distinctive UI, add platform-specific toast styles in `toast.ts`:

```typescript
// In ToastOptions interface
platform: "instagram" | "x" | "threads" | "platform-name";

// In TOAST_CSS
/* Platform Name */
.magpie-toast--platform-name {
  background: #ffffff;
  color: #000000;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,.15);
}
// ... additional styles
```

### 11. Build and Test

```bash
cd extension
npm run build
```

Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` directory

Test on the target platform:
- Posts should show the Magpie save button
- Clicking should open the collection picker
- Saving should work and show toast notification

## Example: Threads Adapter

See `content-scripts/adapters/threads/` for a complete working example.

Key implementation details:

1. **Selectors**: Uses `data-pressable-container` for post containers and standard anchor patterns for links
2. **URL Pattern**: `/@username/post/{threadId}` → canonical `https://www.threads.net/t/{threadId}`
3. **Button Position**: Appended to action bar (Like/Reply/Share container)
4. **Dark Mode**: Detects `prefers-color-scheme` for button color

## Troubleshooting

### Button not appearing
- Check if the post selector matches actual DOM elements
- Verify the action bar selector finds the correct container
- Look for console errors from the content script

### Metadata not extracting
- Test selectors in DevTools console
- Check for dynamic content that loads after initial render
- Verify text content isn't inside shadow DOM

### Save not working
- Ensure canonical URL is valid and unique
- Check network tab for API errors
- Verify collection picker opens correctly

## Platform Adapter Interface Reference

```typescript
interface PlatformAdapter {
  // Identity
  readonly id: string;
  readonly hostMatches: readonly string[];

  // Post Discovery
  findPostElements(root: Element | Document): Element[];
  getPostUrl(postElement: Element): NormalizedPostLink | null;

  // Metadata
  extractMetadata(postElement: Element, link: NormalizedPostLink): Partial<PostMetadata>;

  // Button
  injectButton(postElement: Element, onClick: Function): HTMLButtonElement | null;
  hasButton(postElement: Element): boolean;
  removeStaleButtons(): void;

  // URL
  canonicalizeUrl(rawUrl: string): string | null;

  // Context
  detectSourceContext(): SourceContext;

  // Optional
  findPostRoot?(button: Element): Element | null;
  warmUpVideoThumbnail?(postElement: Element): Promise<void>;
  initialize?(): void;
  onRouteChange?(): void;
}
```
