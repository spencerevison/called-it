import { task, wait } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { wakeCheckinReminder } from "@/lib/checkins/reminder-handler";

export type CheckinReminderPayload = {
  checkinId: string;
  scheduledFor: string;
};

// durable wait to the check-in's scheduled_for; the actual logic lives in
// reminder-handler.ts so it can be tested without spinning up Trigger.dev
export const checkinReminder = task({
  id: "checkin-reminder",
  run: async (payload: CheckinReminderPayload, { ctx }) => {
    await wait.until({ date: new Date(payload.scheduledFor) });

    const service = createServiceClient();
    return wakeCheckinReminder(service, payload.checkinId, ctx.run.id);
  },
});
