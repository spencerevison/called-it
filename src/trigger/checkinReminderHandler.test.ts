import { describe, expect, it, vi } from "vitest"
import { handleCheckinReminder, type CheckinRow } from "./checkinReminderHandler"

function row(overrides: Partial<CheckinRow> = {}): CheckinRow {
  return {
    id: "checkin-1",
    status: "pending",
    scheduled_for: "2026-08-01T00:00:00Z",
    ...overrides,
  }
}

describe("handleCheckinReminder", () => {
  it("waits until scheduled_for then marks a still-pending row due", async () => {
    const fetchCheckin = vi.fn().mockResolvedValue(row())
    const markDue = vi.fn().mockResolvedValue(undefined)
    const waitUntil = vi.fn().mockResolvedValue(undefined)

    const result = await handleCheckinReminder("checkin-1", {
      fetchCheckin,
      markDue,
      waitUntil,
      runId: "run-1",
    })

    expect(result).toEqual({ noop: false })
    expect(waitUntil).toHaveBeenCalledWith(new Date("2026-08-01T00:00:00Z"))
    expect(markDue).toHaveBeenCalledWith("checkin-1", "run-1")
    expect(fetchCheckin).toHaveBeenCalledTimes(2)
  })

  it("self-noops when the row was deleted before waking", async () => {
    const fetchCheckin = vi.fn().mockResolvedValueOnce(row()).mockResolvedValueOnce(null)
    const markDue = vi.fn()
    const waitUntil = vi.fn().mockResolvedValue(undefined)

    const result = await handleCheckinReminder("checkin-1", {
      fetchCheckin,
      markDue,
      waitUntil,
      runId: "run-1",
    })

    expect(result).toEqual({ noop: true })
    expect(markDue).not.toHaveBeenCalled()
  })

  it("self-noops when the row is no longer pending (e.g. already completed)", async () => {
    const fetchCheckin = vi
      .fn()
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "completed" }))
    const markDue = vi.fn()
    const waitUntil = vi.fn().mockResolvedValue(undefined)

    const result = await handleCheckinReminder("checkin-1", {
      fetchCheckin,
      markDue,
      waitUntil,
      runId: "run-1",
    })

    expect(result).toEqual({ noop: true })
    expect(markDue).not.toHaveBeenCalled()
  })

  it("noops immediately if the row never existed (never even waits)", async () => {
    const fetchCheckin = vi.fn().mockResolvedValue(null)
    const markDue = vi.fn()
    const waitUntil = vi.fn()

    const result = await handleCheckinReminder("checkin-1", {
      fetchCheckin,
      markDue,
      waitUntil,
      runId: "run-1",
    })

    expect(result).toEqual({ noop: true })
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
