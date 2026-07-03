import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// browser-side client — anon key only, RLS enforced (DATA_MODEL rule 0: no
// direct writes to user tables from here, server actions only)
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
