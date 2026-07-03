import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const decisionFetchSingle = vi.fn();
const eventsInsert = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "decisions") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: decisionFetchSingle })) })) };
      }
      // decision_events
      return { insert: eventsInsert };
    }),
  })),
}));

import { reaffirmDecision, reverseDecision, reviseDecision } from "./event-actions";

function formWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("event actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    decisionFetchSingle.mockResolvedValue({ data: { user_id: "user-1", status: "active" }, error: null });
    eventsInsert.mockResolvedValue({ error: null });
  });

  it("rejects when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await reaffirmDecision("d1");
    expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
  });

  it("rejects a decision owned by someone else", async () => {
    decisionFetchSingle.mockResolvedValue({ data: { user_id: "user-2", status: "active" }, error: null });
    const result = await reaffirmDecision("d1");
    expect(result.ok).toBe(false);
  });

  it("rejects logging events on a draft decision", async () => {
    decisionFetchSingle.mockResolvedValue({ data: { user_id: "user-1", status: "draft" }, error: null });
    const result = await reaffirmDecision("d1");
    expect(result).toEqual({ ok: false, errors: ["Events can only be logged once a decision is committed."] });
    expect(eventsInsert).not.toHaveBeenCalled();
  });

  it("reaffirms with an empty payload", async () => {
    const result = await reaffirmDecision("d1");
    expect(result).toEqual({ ok: true });
    expect(eventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ decision_id: "d1", event_type: "reaffirmed", payload: {} }),
    );
  });

  it("revises with a note", async () => {
    const result = await reviseDecision("d1", formWith({ note: "changed the timeline" }));
    expect(result).toEqual({ ok: true });
    expect(eventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "revised", payload: { note: "changed the timeline" } }),
    );
  });

  it("rejects a revise with no note", async () => {
    const result = await reviseDecision("d1", formWith({ note: "  " }));
    expect(result.ok).toBe(false);
    expect(eventsInsert).not.toHaveBeenCalled();
  });

  it("reverses with a required reason", async () => {
    const result = await reverseDecision("d1", formWith({ reason: "picked wrong" }));
    expect(result).toEqual({ ok: true });
    expect(eventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "reversed", payload: { note: "picked wrong" } }),
    );
  });

  it("rejects a reverse with no reason", async () => {
    const result = await reverseDecision("d1", formWith({ reason: "" }));
    expect(result).toEqual({ ok: false, errors: ["A one-line reason is required to reverse."] });
    expect(eventsInsert).not.toHaveBeenCalled();
  });
});
