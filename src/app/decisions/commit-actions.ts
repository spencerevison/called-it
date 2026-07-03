"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type CommitResult = { ok: true } | { ok: false; errors: string[] };

function parseScheduledFor(formData: FormData, field: string, label: string): { value: string | null; error: string | null } {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return { value: null, error: `${label} check-in date is required.` };

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { value: null, error: `${label} check-in date is invalid.` };

  return { value: parsed.toISOString(), error: null };
}

// draft -> active is a single RPC call (see commit_decision migration) so the
// status flip, committed event, and the 3 check-in rows either all land or none do
export async function commitDecision(decisionId: string, formData: FormData): Promise<CommitResult> {
  const errors: string[] = [];

  const twoWeeks = parseScheduledFor(formData, "two_weeks", "Two-week");
  if (twoWeeks.error) errors.push(twoWeeks.error);
  const twoMonths = parseScheduledFor(formData, "two_months", "Two-month");
  if (twoMonths.error) errors.push(twoMonths.error);
  const sixMonths = parseScheduledFor(formData, "six_months", "Six-month");
  if (sixMonths.error) errors.push(sixMonths.error);

  if (errors.length > 0 || !twoWeeks.value || !twoMonths.value || !sixMonths.value) {
    return { ok: false, errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { error } = await service.rpc("commit_decision", {
    p_decision_id: decisionId,
    p_user_id: user.id,
    p_two_weeks: twoWeeks.value,
    p_two_months: twoMonths.value,
    p_six_months: sixMonths.value,
  });

  if (error) {
    // same message whether not-found, not-owned, or not-draft — don't leak which
    return { ok: false, errors: ["Decision could not be committed."] };
  }
  return { ok: true };
}
