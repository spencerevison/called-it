import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"
import { supabaseServiceRoleKey, supabaseUrl } from "./env"

// Service-role client for contexts w/ no user session (Trigger.dev tasks,
// the reconciliation cron) -- bypasses RLS, so never expose to the browser.
export function createServiceClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false },
  })
}
