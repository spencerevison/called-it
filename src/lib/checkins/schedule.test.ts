import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trigger = vi.fn();
vi.mock("@/trigger/checkin-reminder", () => ({
  checkinReminder: { trigger },
}));

const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const eq = vi.fn(() => ({ eq: vi.fn(async () => rowsResult) }));
let rowsResult: { data: unknown[] | null };
const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })), update }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from })),
}));

describe("scheduleCheckinReminders", () => {
  const ORIGINAL_ENV = process.env.TRIGGER_SECRET_KEY;

  beforeEach(() => {
    trigger.mockReset();
    update.mockClear();
    from.mockClear();
    rowsResult = { data: [{ id: "c1", scheduled_for: "2026-08-01T00:00:00.000Z" }] };
  });

  afterEach(() => {
    process.env.TRIGGER_SECRET_KEY = ORIGINAL_ENV;
  });

  it("does nothing when no Trigger.dev key is configured", async () => {
    delete process.env.TRIGGER_SECRET_KEY;
    const { scheduleCheckinReminders } = await import("./schedule");
    await scheduleCheckinReminders("d1");
    expect(trigger).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("triggers a reminder per pending row and stores the run id", async () => {
    process.env.TRIGGER_SECRET_KEY = "test-key";
    trigger.mockResolvedValue({ id: "run_123" });
    const { scheduleCheckinReminders } = await import("./schedule");
    await scheduleCheckinReminders("d1");

    expect(trigger).toHaveBeenCalledWith({ checkinId: "c1", scheduledFor: "2026-08-01T00:00:00.000Z" });
    expect(update).toHaveBeenCalledWith({ trigger_run_id: "run_123" });
  });

  it("swallows errors instead of throwing (reconciliation cron is the backstop)", async () => {
    process.env.TRIGGER_SECRET_KEY = "test-key";
    trigger.mockRejectedValue(new Error("network down"));
    const { scheduleCheckinReminders } = await import("./schedule");
    await expect(scheduleCheckinReminders("d1")).resolves.toBeUndefined();
  });
});
