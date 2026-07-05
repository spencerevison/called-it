import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileDueCheckins } from "./reconcile-handler";
import { sendDueNotification } from "./due-notification";

vi.mock("./due-notification", () => ({ sendDueNotification: vi.fn() }));

function buildClient(opts: { rows?: { id: string; decision_id: string; user_id: string }[]; error?: boolean } = {}) {
  const eqCalls: [string, unknown][] = [];
  const ltCalls: [string, unknown][] = [];

  const builder = {
    eq: vi.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    }),
    lt: vi.fn((col: string, val: unknown) => {
      ltCalls.push([col, val]);
      return builder;
    }),
    select: vi.fn(async () => ({
      data: opts.error ? null : (opts.rows ?? []),
      error: opts.error ? { message: "boom" } : null,
    })),
  };
  const update = vi.fn(() => builder);

  return {
    client: {
      from: vi.fn(() => ({ update })),
    } as unknown as Parameters<typeof reconcileDueCheckins>[0],
    update,
    eqCalls,
    ltCalls,
  };
}

describe("reconcileDueCheckins", () => {
  beforeEach(() => {
    vi.mocked(sendDueNotification).mockClear();
  });

  it("marks overdue pending rows due and reports the count", async () => {
    const { client, update, eqCalls, ltCalls } = buildClient({
      rows: [
        { id: "c1", decision_id: "d1", user_id: "u1" },
        { id: "c2", decision_id: "d2", user_id: "u2" },
      ],
    });

    const result = await reconcileDueCheckins(client);

    expect(result).toEqual({ updated: 2 });
    expect(update).toHaveBeenCalledWith({ status: "due" });
    expect(eqCalls).toEqual([["status", "pending"]]);
    expect(ltCalls).toHaveLength(1);
    expect(ltCalls[0][0]).toBe("scheduled_for");
    expect(sendDueNotification).toHaveBeenCalledTimes(2);
    expect(sendDueNotification).toHaveBeenNthCalledWith(1, client, "c1", "d1", "u1");
    expect(sendDueNotification).toHaveBeenNthCalledWith(2, client, "c2", "d2", "u2");
  });

  it("is a no-op scan when nothing is overdue (idempotent re-run)", async () => {
    const { client } = buildClient({ rows: [] });

    const result = await reconcileDueCheckins(client);

    expect(result).toEqual({ updated: 0 });
  });

  it("throws on a query error so Trigger.dev retries instead of a silent no-op", async () => {
    const { client } = buildClient({ error: true });

    await expect(reconcileDueCheckins(client)).rejects.toThrow(
      "checkin reconcile failed: boom",
    );
  });
});
