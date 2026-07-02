import { type EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Supabase's magic link points here with token_hash + type; verifyOtp trades
// those for a session and the ssr helper writes the cookie for us.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const rawNext = searchParams.get("next") ?? "/"
  // only relative paths are safe -- reject anything that could redirect off-site
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      redirect(next)
    }
  }

  redirect("/login")
}
