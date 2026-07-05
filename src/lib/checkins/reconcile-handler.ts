import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDueNotification } from "./due-notification";

type ServiceClient = SupabaseClient<Database>;

// extracted so the cron task file stays a thin wrapper -- same split as
// reminder-handler.ts for checkin-reminder.ts
export async function reconcileDueCheckins(
  client: ServiceClient,
): Promise<{ updated: number }> {
  const { data, error } = await client
    .from("checkins")
    .update({ status: "due" })
    .eq("status", "pending")
    .lt("scheduled_for", new Date().toISOString())
    .select("id, decision_id, user_id");

  if (error) throw new Error(`checkin reconcile failed: ${error.message}`);

  for (const row of data ?? []) {
    await sendDueNotification(client, row.id, row.decision_id, row.user_id);
  }

  return { updated: data?.length ?? 0 };
}
