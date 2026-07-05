import { beforeEach, describe, expect, it, vi } from "vitest";
import { wakeCheckinReminder } from "./reminder-handler";
import { sendDueNotification } from "./due-notification";

vi.mock("./due-notification", () => ({ sendDueNotification: vi.fn() }));

type Row = { status: string; trigger_run_id: string | null } | null;

// rows: one snapshot per successive select() call (lets tests simulate the
// run-id-store race resolving between the initial fetch and the retry)
function buildClient(rows: Row[], opts: { selectError?: boolean; updateError?: boolean; noRowsMatched?: boolean } = {}) {
  let call = 0;
  const maybeSingle = vi.fn(async () => {
    const row = rows[Math.min(call, rows.length - 1)];
    call++;
    return {
      data: opts.selectError ? null : row,
      error: opts.selectError ? { message: "boom" } : null,
    };
  });

  const updateEqCalls: [string, unknown][] = [];
  const updateBuilder = {
    eq: vi.fn((col: string, val: unknown) => {
      updateEqCalls.push([col, val]);
      return updateBuilder;
    }),
    select: vi.fn(async () => ({
      data: opts.updateError
        ? null
        : opts.noRowsMatched
          ? []
          : [{ id: "c1", decision_id: "d1", user_id: "u1" }],
      error: opts.updateError ? { message: "boom" } : null,
    })),
  };
  const update = vi.fn(() => updateBuilder);

  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        update,
      })),
    } as unknown as Parameters<typeof wakeCheckinReminder>[0],
    update,
    updateEqCalls,
  };
}

describe("wakeCheckinReminder", () => {
  beforeEach(() => {
    vi.mocked(sendDueNotification).mockClear();
  });

  it("marks the row due when pending and the run id matches", async () => {
    const { client, update, updateEqCalls } = buildClient([{ status: "pending", trigger_run_id: "run_1" }]);
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: true });
    expect(update).toHaveBeenCalledWith({ status: "due" });
    expect(updateEqCalls).toEqual([
      ["id", "c1"],
      ["status", "pending"],
      ["trigger_run_id", "run_1"],
    ]);
    expect(sendDueNotification).toHaveBeenCalledWith(client, "c1", "d1", "u1");
  });

  it("noops when the row's trigger_run_id doesn't match this run (stale/rescheduled)", async () => {
    const { client, update } = buildClient([{ status: "pending", trigger_run_id: "run_2" }]);
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops when the row is no longer pending", async () => {
    const { client, update } = buildClient([{ status: "due", trigger_run_id: "run_1" }]);
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops when the row was deleted", async () => {
    const { client, update } = buildClient([null]);
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("noops on a select error", async () => {
    const { client, update } = buildClient([{ status: "pending", trigger_run_id: "run_1" }], { selectError: true });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports updated: false when the update itself errors", async () => {
    const { client } = buildClient([{ status: "pending", trigger_run_id: "run_1" }], { updateError: true });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
  });

  it("reports updated: false when the compare-and-set predicate matches no rows (concurrent abandon/complete)", async () => {
    const { client } = buildClient([{ status: "pending", trigger_run_id: "run_1" }], { noRowsMatched: true });
    const result = await wakeCheckinReminder(client, "c1", "run_1");
    expect(result).toEqual({ updated: false });
    expect(sendDueNotification).not.toHaveBeenCalled();
  });

  it("retries once when trigger_run_id is still null (schedule.ts's run-id write hasn't landed yet)", async () => {
    const { client, update } = buildClient([
      { status: "pending", trigger_run_id: null },
      { status: "pending", trigger_run_id: "run_1" },
    ]);
    const result = await wakeCheckinReminder(client, "c1", "run_1", 0);
    expect(result).toEqual({ updated: true });
    expect(update).toHaveBeenCalledWith({ status: "due" });
  });

  it("noops if trigger_run_id is still null after the retry (genuinely stuck, not a race)", async () => {
    const { client, update } = buildClient([
      { status: "pending", trigger_run_id: null },
      { status: "pending", trigger_run_id: null },
    ]);
    const result = await wakeCheckinReminder(client, "c1", "run_1", 0);
    expect(result).toEqual({ updated: false });
    expect(update).not.toHaveBeenCalled();
  });
});
