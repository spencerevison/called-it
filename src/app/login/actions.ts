"use server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type SendMagicLinkResult = { ok: true } | { ok: false; error: string };

export async function sendMagicLink(
  origin: string,
  next: string | null,
  formData: FormData,
): Promise<SendMagicLinkResult> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { ok: false, error: "Email is required." };
  }

  const supabase = await createClient();
  const redirectTo = new URL("/auth/confirm", origin);
  redirectTo.searchParams.set("next", safeNext(next));

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo.toString() },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
