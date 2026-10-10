/**
 * permalink.test.ts
 * Validates normalizeInstagramMediaUrl() for all URL variants:
 * /p/, /reel/, /reels/, query params, hash, trailing slash,
 * invalid pages (stories, explore), sub-pages (liked_by).
 */
import { describe, it, expect } from "vitest";
import { normalizeInstagramMediaUrl } from "../permalink";

describe("normalizeInstagramMediaUrl", () => {
  it("returns canonical /p/ URL", () => {
    const result = normalizeInstagramMediaUrl("https://www.instagram.com/p/ABC123/");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/p/ABC123/");
    expect(result?.shortcode).toBe("ABC123");
    expect(result?.mediaType).toBe("post");
  });

  it("strips query params and hash", () => {
    const result = normalizeInstagramMediaUrl("https://www.instagram.com/p/ABC123/?igshid=xyz#top");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("handles bare instagram.com host", () => {
    const result = normalizeInstagramMediaUrl("https://instagram.com/p/ABC123");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("normalises /reels/ path to /reel/ canonical", () => {
    const result = normalizeInstagramMediaUrl("https://www.instagram.com/reels/DEF456/");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/reel/DEF456/");
    expect(result?.mediaType).toBe("reel");
  });

  it("handles /reel/ directly", () => {
    const result = normalizeInstagramMediaUrl("https://www.instagram.com/reel/DEF456/");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/reel/DEF456/");
  });

  it("handles /tv/ (IGTV)", () => {
    const result = normalizeInstagramMediaUrl("https://www.instagram.com/tv/GHI789/");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/tv/GHI789/");
    expect(result?.mediaType).toBe("igtv");
  });

  it("handles relative path /p/ABC123/", () => {
    const result = normalizeInstagramMediaUrl("/p/ABC123/");
    expect(result?.canonicalUrl).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("returns null for /stories/", () => {
    expect(normalizeInstagramMediaUrl("https://www.instagram.com/stories/user/123/")).toBeNull();
  });

  it("returns null for /explore/", () => {
    expect(normalizeInstagramMediaUrl("https://www.instagram.com/explore/")).toBeNull();
  });

  it("returns null for liked_by sub-page", () => {
    expect(normalizeInstagramMediaUrl("https://www.instagram.com/p/ABC123/liked_by/")).toBeNull();
  });

  it("returns null for reels audio page", () => {
    expect(normalizeInstagramMediaUrl("https://www.instagram.com/reels/audio/12345/")).toBeNull();
  });

  it("returns null for non-Instagram host", () => {
    expect(normalizeInstagramMediaUrl("https://facebook.com/p/ABC123/")).toBeNull();
  });

  it("returns null for invalid URL string", () => {
    expect(normalizeInstagramMediaUrl("not-a-url")).toBeNull();
  });
});
