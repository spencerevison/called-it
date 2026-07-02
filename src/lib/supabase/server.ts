import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "./types"
import { supabaseAnonKey, supabaseUrl } from "./env"

// For use in Server Components, Server Actions, and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component -- middleware refreshes the
          // session instead, so this is safe to swallow.
        }
      },
    },
  })
}
