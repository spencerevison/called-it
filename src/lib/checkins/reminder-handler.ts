import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type ServiceClient = SupabaseClient<Database>;

async function fetchRow(client: ServiceClient, checkinId: string) {
  const { data: row, error } = await client
    .from("checkins")
    .select("status, trigger_run_id")
    .eq("id", checkinId)
    .maybeSingle();

  if (error) return null;
  return row;
}

// extracted so the Trigger.dev task file stays a thin wrapper (wait.until +
// this) and the actual wake logic can be unit-tested with a mocked client
export async function wakeCheckinReminder(
  client: ServiceClient,
  checkinId: string,
  runId: string,
  retryDelayMs = 300,
): Promise<{ updated: boolean }> {
  let row = await fetchRow(client, checkinId);

  if (!row) return { updated: false };

  // trigger_run_id can still be null right after trigger() if schedule.ts's
  // run-id update hasn't landed yet -- give it one short beat before treating
  // this as a stale/rescheduled run (see reminder-handler.ts:12-32 finding)
  if (row.status === "pending" && row.trigger_run_id === null) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    row = await fetchRow(client, checkinId);
    if (!row) return { updated: false };
  }

  // reschedule guard: a newer run overwrote trigger_run_id, so this (stale)
  // run's wake is a noop. also covers deleted rows and any non-pending status.
  if (row.status !== "pending" || row.trigger_run_id !== runId) {
    return { updated: false };
  }

  // compare-and-set: the guard above is advisory (JS-level, racy against a
  // concurrent abandon/complete), so the actual correctness check has to be
  // in the update predicate itself, not just the preceding select
  const { data: updated, error: updateError } = await client
    .from("checkins")
    .update({ status: "due" })
    .eq("id", checkinId)
    .eq("status", "pending")
    .eq("trigger_run_id", runId)
    .select("id");

  return { updated: !updateError && Boolean(updated?.length) };
}
