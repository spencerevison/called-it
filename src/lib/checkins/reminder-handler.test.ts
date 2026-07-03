import { describe, expect, it, vi } from "vitest";
import { wakeCheckinReminder } from "./reminder-handler";

function buildClient(row: { status: string; trigger_run_id: string | null } | null, opts: { selectError?: boolean; updateError?: boolean } = {}) {
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: opts.updateError ? { message: "boom" } : null })),
  }));
  const maybeSingle = vi.fn(async () => ({
    data: opts.selectError ? null : row,
    error: opts.selectError ? { message: "boom" } : null,
  }));

  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        update,
      })),
    } as unknown as Parameters<typeof wakeCheckinReminder>[0],
    update,
  };
}

describe("wakeCheckinReminder", () => {
  it("marks the row due when pending and the run id matches", async () => {
    const { client, update } = buildClient({ status: "pending", trigger_run_id: "run_1" });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: true });
    expect(update).toHaveBeenCalledWith({ status: "due" });
  });

  it("noops when the row's trigger_run_id doesn't match this run (stale/rescheduled)", async () => {
    const { client, update } = buildClient({ status: "pending", trigger_run_id: "run_2" });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops when the row is no longer pending", async () => {
    const { client, update } = buildClient({ status: "due", trigger_run_id: "run_1" });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops when the row was deleted", async () => {
    const { client, update } = buildClient(null);
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops on a select error", async () => {
    const { client, update } = buildClient({ status: "pending", trigger_run_id: "run_1" }, { selectError: true });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports updated: false when the update itself errors", async () => {
    const { client } = buildClient({ status: "pending", trigger_run_id: "run_1" }, { updateError: true });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
  });
});
