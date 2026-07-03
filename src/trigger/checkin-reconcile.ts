import { schedules } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { reconcileDueCheckins } from "@/lib/checkins/reconcile-handler";

// daily healing pass -- backstop for missed/failed checkin-reminder wakes
// (ADR-1). DB is source of truth, so this is just "pending + overdue -> due";
// running it twice in a row is harmless (second run matches zero rows).
export const checkinReconcile = schedules.task({
  id: "checkin-reconcile",
  cron: "0 0 * * *",
  run: async () => {
    const service = createServiceClient();
    return reconcileDueCheckins(service);
  },
});
