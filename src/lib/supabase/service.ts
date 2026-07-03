import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// service-role client — bypasses RLS entirely. Server actions/route handlers
// only (DATA_MODEL rule 0); never expose this to the browser. Ownership +
// cross-row lineage checks live in the calling action, not in policies.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
