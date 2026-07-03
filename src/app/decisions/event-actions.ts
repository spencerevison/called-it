"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type EventResult = { ok: true } | { ok: false; errors: string[] };

type EventType = "revised" | "reversed" | "reaffirmed";

// events are annotations, not field edits — a decision is append-only once
// committed (SPEC F1), so ownership + non-draft is all we gate on here
async function insertEvent(decisionId: string, eventType: EventType, note: string | null): Promise<EventResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { data: decision, error: decisionError } = await service
    .from("decisions")
    .select("user_id, status")
    .eq("id", decisionId)
    .single();

  if (decisionError || !decision || decision.user_id !== user.id) {
    return { ok: false, errors: ["Decision not found."] };
  }
  if (decision.status === "draft") {
    return { ok: false, errors: ["Events can only be logged once a decision is committed."] };
  }

  const { error } = await service.from("decision_events").insert({
    user_id: user.id,
    decision_id: decisionId,
    event_type: eventType,
    payload: note ? { note } : {},
  });

  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}

export async function reviseDecision(decisionId: string, formData: FormData): Promise<EventResult> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, errors: ["A note describing the revision is required."] };
  return insertEvent(decisionId, "revised", note);
}

export async function reverseDecision(decisionId: string, formData: FormData): Promise<EventResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, errors: ["A one-line reason is required to reverse."] };
  return insertEvent(decisionId, "reversed", reason);
}

export async function reaffirmDecision(decisionId: string): Promise<EventResult> {
  return insertEvent(decisionId, "reaffirmed", null);
}
