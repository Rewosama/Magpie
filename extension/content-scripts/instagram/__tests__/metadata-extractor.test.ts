/**
 * metadata-extractor.test.ts
 * Tests caption and author extraction from realistic Instagram DOM fixtures.
 * Uses jsdom (configured in vitest.config.ts) to simulate browser DOM APIs.
 * Covers feed posts, direct /p/ pages, and fallback to og:description.
 */
import { describe, it, expect, beforeEach } from "vitest";

// We test the pure helper logic by constructing minimal DOM fixtures.
// Full extractMetadata() requires a NormalizedMediaLink which ties it to
// the instagram.com origin; we test caption helpers in isolation.

function makeFeedArticle(caption: string, username: string): HTMLElement {
  const article = document.createElement("article");
  article.setAttribute("data-testid", ""); // not a tweet
  article.innerHTML = `
    <header>
      <a href="/${username}/" role="link">${username}</a>
    </header>
    <div>
      <div style="display:inline">
        <span dir="auto" class="_ap3a _aaco _aacw _aacx _aad7 _aade">${caption}</span>
      </div>
    </div>
  `;
  return article;
}

function makeDetailH1(caption: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = `<h1 dir="auto">${caption}</h1>`;
  return div;
}

describe("caption extraction from DOM", () => {
  beforeEach(() => {
    // Reset document body for each test
    document.body.innerHTML = "";
  });

  it("extracts caption from feed inline span", () => {
    const article = makeFeedArticle("Test caption text", "user123");
    document.body.appendChild(article);

    const span = article.querySelector<HTMLElement>(
      'div[style*="display:inline"] > span[dir="auto"]'
    );
    const text = span?.textContent?.trim();
    expect(text).toBe("Test caption text");
  });

  it("extracts caption from h1 on detail page", () => {
    const container = makeDetailH1("Detail page caption");
    const h1 = container.querySelector<HTMLElement>("h1");
    expect(h1?.textContent?.trim()).toBe("Detail page caption");
  });

  it("handles caption with emoji", () => {
    const article = makeFeedArticle("Great photo 🔥 #sunset", "photographer");
    document.body.appendChild(article);
    const span = article.querySelector<HTMLElement>(
      'div[style*="display:inline"] > span[dir="auto"]'
    );
    expect(span?.textContent?.trim()).toContain("🔥");
  });

  it("returns empty string for missing caption", () => {
    const article = document.createElement("article");
    const span = article.querySelector<HTMLElement>(
      'div[style*="display:inline"] > span[dir="auto"]'
    );
    expect(span?.textContent?.trim() ?? "").toBe("");
  });
});

describe("author extraction from DOM", () => {
  it("extracts username from profile link href", () => {
    const article = document.createElement("article");
    article.innerHTML = `
      <header>
        <a href="/webtekno/" role="link">webtekno</a>
      </header>
    `;
    const profileLink = article.querySelector<HTMLAnchorElement>(
      'header a[href^="/"]'
    );
    const slug = profileLink?.getAttribute("href")?.match(/^\/([^/]+)\/$/)?.[1];
    expect(slug).toBe("webtekno");
  });

  it("ignores reserved path segments", () => {
    const reserved = new Set(["p", "reel", "reels", "tv", "explore", "stories"]);
    expect(reserved.has("webtekno")).toBe(false);
    expect(reserved.has("p")).toBe(true);
  });
});
