"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type ForecastFormResult = { ok: true; id: string } | { ok: false; errors: string[] };

type ParsedForecast = {
  question: string;
  probability: number;
  desired: boolean;
  resolveBy: string | null;
};

function parseForecastFields(formData: FormData): { fields: ParsedForecast | null; errors: string[] } {
  const errors: string[] = [];

  const question = String(formData.get("question") ?? "").trim();
  if (!question) errors.push("Question is required.");

  const probabilityRaw = String(formData.get("probability") ?? "");
  const probability = Number(probabilityRaw);
  if (!Number.isFinite(probability) || probability < 0.01 || probability > 0.99) {
    errors.push("Probability must be between 0.01 and 0.99.");
  }

  // checkbox omits the field entirely when unchecked, so absence == false
  const desired = formData.get("desired") === "on" || formData.get("desired") === "true";

  const resolveByRaw = String(formData.get("resolve_by") ?? "").trim();
  const resolveBy = resolveByRaw ? resolveByRaw : null;

  if (errors.length > 0) return { fields: null, errors };

  return { fields: { question, probability, desired, resolveBy }, errors: [] };
}

// forecasts are judge input (DATA_MODEL integrity rule 1) — only writable while the parent decision is a draft
async function assertDraftDecisionOwner(
  service: ReturnType<typeof createServiceClient>,
  decisionId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await service
    .from("decisions")
    .select("user_id, status")
    .eq("id", decisionId)
    .single();

  if (error || !data || data.user_id !== userId) return "Decision not found.";
  if (data.status !== "draft") return "Forecasts can only be added or edited while the decision is a draft.";
  return null;
}

export async function createForecast(decisionId: string, formData: FormData): Promise<ForecastFormResult> {
  const { fields, errors } = parseForecastFields(formData);
  if (!fields) return { ok: false, errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const ownerError = await assertDraftDecisionOwner(service, decisionId, user.id);
  if (ownerError) return { ok: false, errors: [ownerError] };

  const { data, error } = await service
    .from("forecasts")
    .insert({
      user_id: user.id,
      decision_id: decisionId,
      question: fields.question,
      probability: fields.probability,
      desired: fields.desired,
      resolve_by: fields.resolveBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, errors: [error?.message ?? "Failed to save forecast."] };
  }
  return { ok: true, id: data.id };
}

export async function updateForecast(forecastId: string, formData: FormData): Promise<ForecastFormResult> {
  const { fields, errors } = parseForecastFields(formData);
  if (!fields) return { ok: false, errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  // fetch via service role so a not-found and a not-owned forecast look identical to the caller
  const { data: existing, error: fetchError } = await service
    .from("forecasts")
    .select("user_id, decision_id")
    .eq("id", forecastId)
    .single();

  if (fetchError || !existing || existing.user_id !== user.id) {
    return { ok: false, errors: ["Forecast not found."] };
  }

  const ownerError = await assertDraftDecisionOwner(service, existing.decision_id, user.id);
  if (ownerError) return { ok: false, errors: [ownerError] };

  const { error } = await service
    .from("forecasts")
    .update({
      question: fields.question,
      probability: fields.probability,
      desired: fields.desired,
      resolve_by: fields.resolveBy,
    })
    .eq("id", forecastId);

  if (error) return { ok: false, errors: [error.message] };
  return { ok: true, id: forecastId };
}
