import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    getUser.mockReset();
  });

  it("redirects unauthenticated visits to app routes, preserving next", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("./middleware");

    const req = new NextRequest("http://localhost:3000/decisions/123?foo=bar");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/decisions/123?foo=bar");
  });

  it("lets unauthenticated visits to /login and /auth/confirm through", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import("./middleware");

    const login = await updateSession(new NextRequest("http://localhost:3000/login"));
    const confirm = await updateSession(
      new NextRequest("http://localhost:3000/auth/confirm?token_hash=abc&type=email"),
    );

    expect(login.headers.get("location")).toBeNull();
    expect(confirm.headers.get("location")).toBeNull();
  });

  it("lets authenticated visits through without redirect", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { updateSession } = await import("./middleware");

    const res = await updateSession(new NextRequest("http://localhost:3000/decisions"));

    expect(res.headers.get("location")).toBeNull();
  });
});
