import { task, wait } from "@trigger.dev/sdk"
import { createServiceClient } from "@/lib/supabase/service"
import { handleCheckinReminder } from "./checkinReminderHandler"

export type CheckinReminderPayload = { checkinId: string }

// Fired once at commit time per checkin row. Sleeps (durably -- no compute
// billed past 5s) until scheduled_for, then flips the row to 'due' unless
// it's no longer pending (completed/skipped/deleted while we slept). The
// daily reconciliation cron (T30) is the backstop if this run never wakes.
export const checkinReminder = task({
  id: "checkin-reminder",
  run: async (payload: CheckinReminderPayload, { ctx }) => {
    const supabase = createServiceClient()

    return handleCheckinReminder(payload.checkinId, {
      fetchCheckin: async (checkinId) => {
        const { data } = await supabase
          .from("checkins")
          .select("id, status, scheduled_for")
          .eq("id", checkinId)
          .maybeSingle()
        return data
      },
      markDue: async (checkinId, runId) => {
        await supabase
          .from("checkins")
          .update({ status: "due", trigger_run_id: runId })
          .eq("id", checkinId)
      },
      waitUntil: (date) => wait.until({ date, throwIfInThePast: false }),
      runId: ctx.run.id,
    })
  },
})
