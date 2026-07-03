import { describe, expect, it, vi } from "vitest";
import { reconcileDueCheckins } from "./reconcile-handler";

function buildClient(opts: { rows?: { id: string }[]; error?: boolean } = {}) {
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
  it("marks overdue pending rows due and reports the count", async () => {
    const { client, update, eqCalls, ltCalls } = buildClient({
      rows: [{ id: "c1" }, { id: "c2" }],
    });

    const result = await reconcileDueCheckins(client);

    expect(result).toEqual({ updated: 2 });
    expect(update).toHaveBeenCalledWith({ status: "due" });
    expect(eqCalls).toEqual([["status", "pending"]]);
    expect(ltCalls).toHaveLength(1);
    expect(ltCalls[0][0]).toBe("scheduled_for");
  });

  it("is a no-op scan when nothing is overdue (idempotent re-run)", async () => {
    const { client } = buildClient({ rows: [] });

    const result = await reconcileDueCheckins(client);

    expect(result).toEqual({ updated: 0 });
  });

  it("returns updated: 0 on a query error rather than throwing", async () => {
    const { client } = buildClient({ error: true });

    const result = await reconcileDueCheckins(client);

    expect(result).toEqual({ updated: 0 });
  });
});
