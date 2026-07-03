import { describe, expect, it, vi } from "vitest";
import { createClient } from "./client";

describe("supabase browser client", () => {
  it("constructs without throwing given env vars", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(() => createClient()).not.toThrow();
  });
});
