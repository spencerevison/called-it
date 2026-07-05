import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/supabase/types";

type ServiceClient = SupabaseClient<Database>;

export function hasResendKey(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// best-effort, called only for rows the caller's own pending->due CAS update
// actually flipped -- a row already 'due' never matches that predicate again,
// so this naturally sends once per transition even across cron re-runs.
export async function sendDueNotification(
  client: ServiceClient,
  checkinId: string,
  decisionId: string,
  userId: string,
): Promise<void> {
  if (!hasResendKey()) return;

  try {
    const [{ data: decision }, { data: userRes }] = await Promise.all([
      client.from("decisions").select("title").eq("id", decisionId).maybeSingle(),
      client.auth.admin.getUserById(userId),
    ]);

    const email = userRes?.user?.email;
    if (!decision || !email) return;

    const link = `${siteUrl()}/decisions/${decisionId}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "notifications@called-it.app",
      to: email,
      subject: `Check-in due: ${decision.title}`,
      html: `<p>Your check-in for "<strong>${escapeHtml(decision.title)}</strong>" is due.</p><p><a href="${link}">Review it</a></p>`,
    });
  } catch (err) {
    console.error("sendDueNotification failed", checkinId, err);
  }
}
