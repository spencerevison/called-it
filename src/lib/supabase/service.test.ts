import { describe, expect, it, vi } from "vitest";
import { createServiceClient } from "./service";

describe("supabase service-role client", () => {
  it("constructs without throwing given env vars", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    expect(() => createServiceClient()).not.toThrow();
  });
});
