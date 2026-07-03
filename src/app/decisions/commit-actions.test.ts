import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ rpc })),
}));

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const VALID_FIELDS = {
  two_weeks: "2026-07-17T09:00",
  two_months: "2026-09-03T09:00",
  six_months: "2027-01-03T09:00",
};

describe("commitDecision", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("rejects a missing date field", async () => {
    const { commitDecision } = await import("./commit-actions");
    const result = await commitDecision(
      "d1",
      buildFormData({ two_weeks: "", two_months: VALID_FIELDS.two_months, six_months: VALID_FIELDS.six_months }),
    );
    expect(result).toEqual({ ok: false, errors: ["Two-week check-in date is required."] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unparsable date field", async () => {
    const { commitDecision } = await import("./commit-actions");
    const result = await commitDecision(
      "d1",
      buildFormData({ ...VALID_FIELDS, six_months: "not-a-date" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Six-month check-in date is invalid.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { commitDecision } = await import("./commit-actions");
    const result = await commitDecision("d1", buildFormData(VALID_FIELDS));
    expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the commit_decision RPC with the caller's id and ISO-normalized dates", async () => {
    rpc.mockResolvedValue({ error: null });
    const { commitDecision } = await import("./commit-actions");
    const result = await commitDecision("d1", buildFormData(VALID_FIELDS));

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("commit_decision", {
      p_decision_id: "d1",
      p_user_id: "u1",
      p_two_weeks: new Date(VALID_FIELDS.two_weeks).toISOString(),
      p_two_months: new Date(VALID_FIELDS.two_months).toISOString(),
      p_six_months: new Date(VALID_FIELDS.six_months).toISOString(),
    });
  });

  it("surfaces a generic error without leaking not-found vs not-owned vs not-draft", async () => {
    rpc.mockResolvedValue({ error: { message: "only a draft decision can be committed" } });
    const { commitDecision } = await import("./commit-actions");
    const result = await commitDecision("d1", buildFormData(VALID_FIELDS));
    expect(result).toEqual({ ok: false, errors: ["Decision could not be committed."] });
  });
});
