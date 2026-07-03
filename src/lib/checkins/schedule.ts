import { createServiceClient } from "@/lib/supabase/service";
import { checkinReminder } from "@/trigger/checkin-reminder";

export function hasTriggerKey(): boolean {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

// best-effort: triggers a checkinReminder run per pending check-in on a
// decision and records the run id (guards the reschedule race, see
// reminder-handler.ts). The daily reconciliation cron (T30) is the source of
// truth if this never fires or Trigger.dev is unavailable, so failures here
// are swallowed rather than surfaced to the caller.
export async function scheduleCheckinReminders(decisionId: string): Promise<void> {
  if (!hasTriggerKey()) return;

  try {
    const service = createServiceClient();
    const { data: rows } = await service
      .from("checkins")
      .select("id, scheduled_for")
      .eq("decision_id", decisionId)
      .eq("status", "pending");

    if (!rows) return;

    for (const row of rows) {
      const handle = await checkinReminder.trigger({ checkinId: row.id, scheduledFor: row.scheduled_for });
      const { error: runIdError } = await service.from("checkins").update({ trigger_run_id: handle.id }).eq("id", row.id);
      if (runIdError) console.error("failed to record trigger_run_id for checkin", row.id, runIdError);
    }
  } catch (err) {
    console.error("scheduleCheckinReminders failed", err);
  }
}
