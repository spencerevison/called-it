import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp },
  })),
}));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
  });

  it("redirects to safeNext(next) on a valid token", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("./route");

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=abc&type=email&next=/decisions",
    );
    const res = await GET(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/decisions");
  });

  it("rejects an off-site next even on a valid token", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("./route");

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=abc&type=email&next=https://evil.com",
    );
    const res = await GET(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects to /login on a bad/expired token", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const { GET } = await import("./route");

    const req = new NextRequest(
      "http://localhost:3000/auth/confirm?token_hash=bad&type=email",
    );
    const res = await GET(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=link-expired");
  });

  it("redirects to /login when params are missing", async () => {
    const { GET } = await import("./route");

    const req = new NextRequest("http://localhost:3000/auth/confirm");
    const res = await GET(req);

    expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=link-expired");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
