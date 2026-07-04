"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true } | { ok: false; errors: string[] };

export type RecallForecast = {
  id: string;
  question: string;
  desired: boolean;
  resolved: boolean;
  outcome: boolean | null;
  recalled_probability: number | null;
  revealed_at: string | null;
  // null until revealed -- recorded value must never reach the client before then (DATA_MODEL rule 2)
  probability: number | null;
};

type CheckinRow = { id: string; user_id: string; decision_id: string; status: string };

async function fetchOwnedCheckin(
  service: ReturnType<typeof createServiceClient>,
  checkinId: string,
  userId: string,
): Promise<CheckinRow | null> {
  const { data, error } = await service
    .from("checkins")
    .select("id, user_id, decision_id, status")
    .eq("id", checkinId)
    .single();

  if (error || !data || data.user_id !== userId) return null;
  return data;
}

export async function getRecallForecasts(
  checkinId: string,
): Promise<{ ok: true; decisionId: string; forecasts: RecallForecast[] } | { ok: false; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const checkin = await fetchOwnedCheckin(service, checkinId, user.id);
  if (!checkin) return { ok: false, errors: ["Check-in not found."] };

  const { data, error } = await service
    .from("forecasts")
    .select("id, question, desired, resolved, outcome, probability, recalled_probability, revealed_at")
    .eq("decision_id", checkin.decision_id)
    .eq("resolved", false)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, errors: [error.message] };

  const forecasts = (data ?? []).map((f) => ({
    ...f,
    probability: f.revealed_at ? f.probability : null,
  }));

  return { ok: true, decisionId: checkin.decision_id, forecasts };
}

export async function submitOutcomeNotes(checkinId: string, formData: FormData): Promise<ActionResult> {
  const notes = String(formData.get("outcome_notes") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const checkin = await fetchOwnedCheckin(service, checkinId, user.id);
  if (!checkin) return { ok: false, errors: ["Check-in not found."] };

  const { error } = await service.from("checkins").update({ outcome_notes: notes }).eq("id", checkinId);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
}

async function fetchOwnedForecast(
  service: ReturnType<typeof createServiceClient>,
  forecastId: string,
  userId: string,
) {
  const { data, error } = await service
    .from("forecasts")
    .select("id, user_id, decision_id, resolved, revealed_at")
    .eq("id", forecastId)
    .single();

  if (error || !data || data.user_id !== userId) return null;
  return data;
}

// write-once, only while revealed_at is null (DATA_MODEL rule 2) -- the DB doesn't
// enforce this so it lives here, same as the other cross-row invariants
export async function recordRecall(forecastId: string, recalledProbability: number): Promise<ActionResult> {
  if (!Number.isFinite(recalledProbability) || recalledProbability < 0.01 || recalledProbability > 0.99) {
    return { ok: false, errors: ["Recalled probability must be between 0.01 and 0.99."] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const forecast = await fetchOwnedForecast(service, forecastId, user.id);
  if (!forecast) return { ok: false, errors: ["Forecast not found."] };
  if (forecast.revealed_at) return { ok: false, errors: ["Recall was already captured for this forecast."] };

  const { data, error } = await service
    .from("forecasts")
    .update({ recalled_probability: recalledProbability, recalled_at: new Date().toISOString() })
    .eq("id", forecastId)
    .is("revealed_at", null)
    .select("id");

  if (error) return { ok: false, errors: [error.message] };
  if (!data || data.length === 0) {
    return { ok: false, errors: ["Recall was already captured for this forecast."] };
  }
  return { ok: true };
}

export async function revealForecast(
  forecastId: string,
): Promise<{ ok: true; probability: number } | { ok: false; errors: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const forecast = await fetchOwnedForecast(service, forecastId, user.id);
  if (!forecast) return { ok: false, errors: ["Forecast not found."] };

  const { error } = await service
    .from("forecasts")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", forecastId)
    .is("revealed_at", null)
    .select("id");
  // zero rows back just means another request already revealed it -- fine, fall through to the refetch
  if (error) return { ok: false, errors: [error.message] };

  const { data, error: refetchError } = await service
    .from("forecasts")
    .select("probability")
    .eq("id", forecastId)
    .single();

  if (refetchError || !data) return { ok: false, errors: ["Failed to load the recorded probability."] };
  return { ok: true, probability: data.probability };
}

export async function resolveForecast(
  checkinId: string,
  forecastId: string,
  outcome: "yes" | "no" | "unresolved",
): Promise<ActionResult> {
  if (outcome === "unresolved") return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const checkin = await fetchOwnedCheckin(service, checkinId, user.id);
  if (!checkin) return { ok: false, errors: ["Check-in not found."] };

  const forecast = await fetchOwnedForecast(service, forecastId, user.id);
  if (!forecast) return { ok: false, errors: ["Forecast not found."] };
  if (forecast.decision_id !== checkin.decision_id) {
    return { ok: false, errors: ["Forecast does not belong to this decision."] };
  }
  if (!forecast.revealed_at) {
    return { ok: false, errors: ["Reveal the recorded probability before resolving."] };
  }
  if (forecast.resolved) {
    return { ok: false, errors: ["This forecast has already been resolved."] };
  }

  const { data, error } = await service
    .from("forecasts")
    .update({
      resolved: true,
      outcome: outcome === "yes",
      resolved_at: new Date().toISOString(),
      resolved_in_checkin_id: checkinId,
    })
    .eq("id", forecastId)
    .eq("resolved", false)
    .select("id");

  if (error) return { ok: false, errors: [error.message] };
  if (!data || data.length === 0) {
    return { ok: false, errors: ["This forecast has already been resolved."] };
  }
  return { ok: true };
}
