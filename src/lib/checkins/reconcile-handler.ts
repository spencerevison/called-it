import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

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
    .select("id");

  if (error) return { updated: 0 };
  return { updated: data?.length ?? 0 };
}
