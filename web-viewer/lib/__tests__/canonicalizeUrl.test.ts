import { describe, it, expect } from "vitest";
import {
  canonicalizeUrl,
  detectPlatform,
  type Platform,
} from "../canonicalizeUrl";

describe("detectPlatform", () => {
  it("detects Instagram URLs", () => {
    expect(detectPlatform("https://www.instagram.com/p/ABC123/")).toBe(
      "instagram",
    );
    expect(detectPlatform("https://instagram.com/reel/XYZ/")).toBe("instagram");
  });

  it("detects X/Twitter URLs", () => {
    expect(detectPlatform("https://x.com/user/status/123")).toBe("x");
    expect(detectPlatform("https://twitter.com/user/status/456")).toBe("x");
    expect(detectPlatform("https://www.x.com/i/web/status/789")).toBe("x");
  });

  it("detects Threads URLs", () => {
    expect(detectPlatform("https://www.threads.net/t/ABC123")).toBe("threads");
    expect(detectPlatform("https://threads.net/@user/post/XYZ")).toBe(
      "threads",
    );
  });

  it("returns null for unknown URLs", () => {
    expect(detectPlatform("https://facebook.com/post/123")).toBeNull();
    expect(detectPlatform("https://example.com")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
  });
});

describe("canonicalizeUrl - Instagram", () => {
  const platform: Platform = "instagram";

  it("canonicalizes /p/ post URLs", () => {
    expect(
      canonicalizeUrl("https://www.instagram.com/p/ABC123/", platform),
    ).toBe("https://www.instagram.com/p/ABC123/");
    expect(
      canonicalizeUrl("https://instagram.com/p/ABC123/?utm=source", platform),
    ).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("canonicalizes /reel/ URLs", () => {
    expect(
      canonicalizeUrl("https://www.instagram.com/reel/ABC123/", platform),
    ).toBe("https://www.instagram.com/reel/ABC123/");
  });

  it("normalizes /reels/ to /reel/", () => {
    expect(
      canonicalizeUrl("https://www.instagram.com/reels/ABC123/", platform),
    ).toBe("https://www.instagram.com/reel/ABC123/");
  });

  it("handles username/type/code pattern", () => {
    expect(
      canonicalizeUrl("https://www.instagram.com/username/p/ABC123/", platform),
    ).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("rejects non-post URLs", () => {
    expect(
      canonicalizeUrl("https://www.instagram.com/username/", platform),
    ).toBeNull();
    expect(
      canonicalizeUrl("https://www.instagram.com/explore/", platform),
    ).toBeNull();
  });

  it("rejects sub-pages", () => {
    expect(
      canonicalizeUrl(
        "https://www.instagram.com/p/ABC123/liked_by/",
        platform,
      ),
    ).toBeNull();
    expect(
      canonicalizeUrl(
        "https://www.instagram.com/p/ABC123/comments/",
        platform,
      ),
    ).toBeNull();
  });
});

describe("canonicalizeUrl - X/Twitter", () => {
  const platform: Platform = "x";

  it("canonicalizes twitter.com to x.com", () => {
    expect(
      canonicalizeUrl("https://twitter.com/user/status/12345", platform),
    ).toBe("https://x.com/i/web/status/12345");
  });

  it("strips tracking params", () => {
    expect(
      canonicalizeUrl("https://x.com/user/status/12345?s=20&t=abc", platform),
    ).toBe("https://x.com/i/web/status/12345");
  });

  it("handles /i/web/status/ format", () => {
    expect(
      canonicalizeUrl("https://x.com/i/web/status/12345", platform),
    ).toBe("https://x.com/i/web/status/12345");
  });

  it("rejects non-status URLs", () => {
    expect(canonicalizeUrl("https://x.com/user", platform)).toBeNull();
    expect(canonicalizeUrl("https://x.com/explore", platform)).toBeNull();
  });

  it("rejects non-numeric status IDs", () => {
    expect(
      canonicalizeUrl("https://x.com/user/status/abc", platform),
    ).toBeNull();
  });
});

describe("canonicalizeUrl - Threads", () => {
  const platform: Platform = "threads";

  it("canonicalizes /t/ URLs", () => {
    expect(
      canonicalizeUrl("https://www.threads.net/t/ABC123", platform),
    ).toBe("https://www.threads.net/t/ABC123/");
  });

  it("canonicalizes /@user/post/ URLs to /t/ format", () => {
    expect(
      canonicalizeUrl("https://www.threads.net/@user/post/ABC123", platform),
    ).toBe("https://www.threads.net/t/ABC123/");
  });

  it("rejects non-post URLs", () => {
    expect(
      canonicalizeUrl("https://www.threads.net/@user", platform),
    ).toBeNull();
  });
});
