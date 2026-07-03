import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type ServiceClient = SupabaseClient<Database>;

// extracted so the Trigger.dev task file stays a thin wrapper (wait.until +
// this) and the actual wake logic can be unit-tested with a mocked client
export async function wakeCheckinReminder(
  client: ServiceClient,
  checkinId: string,
  runId: string,
): Promise<{ updated: boolean }> {
  const { data: row, error } = await client
    .from("checkins")
    .select("status, trigger_run_id")
    .eq("id", checkinId)
    .maybeSingle();

  if (error || !row) return { updated: false };

  // reschedule guard: a newer run overwrote trigger_run_id, so this (stale)
  // run's wake is a noop. also covers deleted rows and any non-pending status.
  if (row.status !== "pending" || row.trigger_run_id !== runId) {
    return { updated: false };
  }

  const { error: updateError } = await client
    .from("checkins")
    .update({ status: "due" })
    .eq("id", checkinId);

  return { updated: !updateError };
}
