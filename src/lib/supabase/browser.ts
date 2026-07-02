import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./types"
import { supabaseAnonKey, supabaseUrl } from "./env"

// One client per call site is fine here -- createBrowserClient is cheap and
// memoizes the underlying auth storage internally.
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
}
