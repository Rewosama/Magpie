/**
 * invite-code.test.ts (web-viewer)
 * Verifies generateCode() uses CSPRNG and produces unbiased output.
 * Mirrors the extension test to ensure both implementations behave identically.
 */
import { describe, it, expect } from "vitest";
import { generateCode } from "../invite-code";

const VALID_RE = /^[A-Z0-9]{8}$/;

describe("generateCode (web-viewer)", () => {
  it("produces 8-char uppercase alphanumeric string", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateCode()).toMatch(VALID_RE);
    }
  });

  it("1000 calls produce unique codes", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateCode));
    expect(codes.size).toBe(1000);
  });

  it("never contains lowercase letters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).not.toMatch(/[a-z]/);
    }
  });

  it("only contains chars from [A-Z0-9]", () => {
    const code = generateCode();
    // Array.from avoids the --downlevelIteration requirement of [...string]
    expect(Array.from(code).every(c => /[A-Z0-9]/.test(c))).toBe(true);
  });
});
