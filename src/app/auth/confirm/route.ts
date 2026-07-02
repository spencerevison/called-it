import { type EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// only same-origin relative paths are safe. resolve against a throwaway origin
// and keep it only if it stays there -- the URL parser folds `\` -> `/`, so the
// /\evil.com backslash trick resolves to host evil.com and gets rejected.
export function safeNext(rawNext: string | null): string {
  if (!rawNext) return "/"
  try {
    const u = new URL(rawNext, "http://localhost")
    if (u.origin === "http://localhost") return u.pathname + u.search + u.hash
  } catch {
    // malformed next -- fall back to "/"
  }
  return "/"
}

// Supabase's magic link points here with token_hash + type; verifyOtp trades
// those for a session and the ssr helper writes the cookie for us.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNext(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      redirect(next)
    }
  }

  redirect("/login")
}
