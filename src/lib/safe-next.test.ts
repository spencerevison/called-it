import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("passes through relative paths", () => {
    expect(safeNext("/decisions/123")).toBe("/decisions/123");
    expect(safeNext("/decisions?x=1#y")).toBe("/decisions?x=1#y");
  });

  it("defaults to / when missing", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  // the four bypass vectors from docs/EVIDENCE.md — the naive
  // startsWith("/") && !startsWith("//") guard let /\evil.com through
  it("rejects off-site bypass vectors", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https:evil.com")).toBe("/");
  });

  it("rejects malformed input instead of throwing", () => {
    expect(safeNext("http://[::1")).toBe("/");
  });
});
