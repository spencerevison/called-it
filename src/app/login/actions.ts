"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export type SendMagicLinkResult = { ok: true } | { ok: false; error: string }

export async function sendMagicLink(formData: FormData): Promise<SendMagicLinkResult> {
  const email = formData.get("email")
  if (typeof email !== "string" || email.trim() === "") {
    return { ok: false, error: "Enter an email address." }
  }

  const origin = (await headers()).get("origin")
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
