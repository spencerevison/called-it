import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ rpc })),
}));

describe("resolveDecision", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("rejects when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { resolveDecision } = await import("./resolve-actions");
    const result = await resolveDecision("d1", "resolved");
    expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the resolve_decision RPC with the caller's id and requested status", async () => {
    rpc.mockResolvedValue({ error: null });
    const { resolveDecision } = await import("./resolve-actions");
    const result = await resolveDecision("d1", "abandoned");

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("resolve_decision", {
      p_decision_id: "d1",
      p_user_id: "u1",
      p_status: "abandoned",
    });
  });

  it("surfaces the RPC error", async () => {
    rpc.mockResolvedValue({ error: { message: "only an active decision can be resolved or abandoned" } });
    const { resolveDecision } = await import("./resolve-actions");
    const result = await resolveDecision("d1", "resolved");
    expect(result).toEqual({
      ok: false,
      errors: ["only an active decision can be resolved or abandoned"],
    });
  });
});
