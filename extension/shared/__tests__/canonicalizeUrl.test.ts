/**
 * canonicalizeUrl.test.ts — Unit tests (run with: npx vitest --run)
 */
import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../canonicalizeUrl";

describe("Instagram", () => {
  it("plain /p/ URL passes through unchanged", () => {
    expect(canonicalizeUrl("https://www.instagram.com/p/ABC123/", "instagram"))
      .toBe("https://www.instagram.com/p/ABC123/");
  });

  it("strips query params and hash", () => {
    expect(canonicalizeUrl("https://www.instagram.com/p/ABC123/?igshid=xyz&utm=1#top", "instagram"))
      .toBe("https://www.instagram.com/p/ABC123/");
  });

  it("normalises bare instagram.com host", () => {
    expect(canonicalizeUrl("https://instagram.com/p/ABC123", "instagram"))
      .toBe("https://www.instagram.com/p/ABC123/");
  });

  it("normalises /reels/ to /reel/", () => {
    expect(canonicalizeUrl("https://www.instagram.com/reels/DEF456/", "instagram"))
      .toBe("https://www.instagram.com/reel/DEF456/");
  });

  it("/reel/ passes through as /reel/", () => {
    expect(canonicalizeUrl("https://www.instagram.com/reel/DEF456/", "instagram"))
      .toBe("https://www.instagram.com/reel/DEF456/");
  });

  it("/tv/ works", () => {
    expect(canonicalizeUrl("https://www.instagram.com/tv/GHI789/", "instagram"))
      .toBe("https://www.instagram.com/tv/GHI789/");
  });

  it("rejects /stories/ URLs", () => {
    expect(canonicalizeUrl("https://www.instagram.com/stories/user/123/", "instagram"))
      .toBeNull();
  });

  it("rejects /explore/", () => {
    expect(canonicalizeUrl("https://www.instagram.com/explore/", "instagram"))
      .toBeNull();
  });

  it("rejects /p/ABC123/liked_by/ sub-page", () => {
    expect(canonicalizeUrl("https://www.instagram.com/p/ABC123/liked_by/", "instagram"))
      .toBeNull();
  });

  it("rejects non-Instagram host", () => {
    expect(canonicalizeUrl("https://facebook.com/p/ABC123/", "instagram"))
      .toBeNull();
  });
});

describe("X / Twitter", () => {
  it("x.com/user/status/id passes through normalised", () => {
    expect(canonicalizeUrl("https://x.com/user/status/123456", "x"))
      .toBe("https://x.com/i/web/status/123456");
  });

  it("twitter.com → x.com normalisation", () => {
    expect(canonicalizeUrl("https://twitter.com/user/status/123456", "x"))
      .toBe("https://x.com/i/web/status/123456");
  });

  it("strips tracking params (s, t, ref_src)", () => {
    expect(canonicalizeUrl("https://x.com/user/status/123456?s=20&t=abc&ref_src=twsrc", "x"))
      .toBe("https://x.com/i/web/status/123456");
  });

  it("/i/web/status/{id} format works", () => {
    expect(canonicalizeUrl("https://x.com/i/web/status/123456", "x"))
      .toBe("https://x.com/i/web/status/123456");
  });

  it("same tweet via different usernames deduplicates", () => {
    const a = canonicalizeUrl("https://twitter.com/user1/status/123456", "x");
    const b = canonicalizeUrl("https://x.com/user2/status/123456", "x");
    expect(a).toBe(b);
  });

  it("strips /photo/1 sub-path", () => {
    expect(canonicalizeUrl("https://x.com/user/status/123456/photo/1", "x"))
      .toBe("https://x.com/i/web/status/123456");
  });

  it("rejects profile-only URL", () => {
    expect(canonicalizeUrl("https://x.com/user", "x"))
      .toBeNull();
  });

  it("rejects search URL", () => {
    expect(canonicalizeUrl("https://x.com/search?q=hello", "x"))
      .toBeNull();
  });

  it("rejects non-X host", () => {
    expect(canonicalizeUrl("https://facebook.com/user/status/123", "x"))
      .toBeNull();
  });

  it("rejects invalid URL string", () => {
    expect(canonicalizeUrl("not-a-url", "x"))
      .toBeNull();
  });
});
