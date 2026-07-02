// Pure handler for the checkinReminder task, decoupled from the Trigger.dev
// SDK so it's testable w/o spinning up a run. The task file (checkinReminder.ts)
// is a thin wrapper that supplies real fetch/setDue/wait implementations.

export type CheckinRow = {
  id: string
  status: "pending" | "due" | "completed" | "skipped"
  scheduled_for: string
}

export type CheckinReminderDeps = {
  fetchCheckin: (checkinId: string) => Promise<CheckinRow | null>
  markDue: (checkinId: string, runId: string) => Promise<void>
  waitUntil: (date: Date) => Promise<void>
  runId: string
}

export type CheckinReminderResult = { noop: true } | { noop: false }

export async function handleCheckinReminder(
  checkinId: string,
  deps: CheckinReminderDeps,
): Promise<CheckinReminderResult> {
  const checkin = await deps.fetchCheckin(checkinId)
  if (!checkin) return { noop: true }

  await deps.waitUntil(new Date(checkin.scheduled_for))

  // row is source of truth -- someone may have completed/skipped/rescheduled
  // it while we were asleep, so re-fetch instead of trusting the first read
  const fresh = await deps.fetchCheckin(checkinId)
  if (!fresh || fresh.status !== "pending") return { noop: true }

  await deps.markDue(checkinId, deps.runId)
  return { noop: false }
}
