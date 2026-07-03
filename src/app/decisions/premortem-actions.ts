"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasAnthropicKey } from "@/lib/llm/client";
import { generatePremortemRisks, RISK_CATEGORIES, RISK_SEVERITIES, type RiskCategory, type RiskSeverity } from "@/lib/llm/premortem";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/template";
import { startTrace } from "@/lib/llm/tracing";

const PROMPT_VERSION = "premortem_v1";
const HORIZON_MONTHS = 6; // the final check-in horizon, per DATA_MODEL

export type PremortemResult = { ok: true; id: string } | { ok: false; errors: string[] };

export async function generatePremortem(decisionId: string): Promise<PremortemResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { data: decision, error: decisionError } = await service
    .from("decisions")
    .select("user_id, status, title, context, rationale, options_considered, chosen_option, stakes, reversibility")
    .eq("id", decisionId)
    .single();

  if (decisionError || !decision || decision.user_id !== user.id) {
    return { ok: false, errors: ["Decision not found."] };
  }
  if (decision.status !== "draft") {
    return { ok: false, errors: ["Pre-mortems can only be generated while the decision is a draft."] };
  }

  const options = Array.isArray(decision.options_considered) ? (decision.options_considered as string[]) : [];
  if (options.length < 2) {
    return { ok: false, errors: ["At least 2 options are required to generate a pre-mortem."] };
  }

  if (!hasAnthropicKey()) {
    return { ok: false, errors: ["ANTHROPIC_API_KEY is not configured."] };
  }

  const { data: forecasts } = await service
    .from("forecasts")
    .select("question, probability, desired")
    .eq("decision_id", decisionId)
    .order("created_at");

  const template = await loadPromptTemplate(PROMPT_VERSION);
  const promptContext = {
    title: decision.title,
    context: decision.context,
    options_considered: options.join(", "),
    chosen_option: decision.chosen_option ?? "(not yet chosen)",
    rationale: decision.rationale ?? "(none given)",
    stakes: decision.stakes,
    reversibility: decision.reversibility,
    horizon_months: HORIZON_MONTHS,
    forecasts: forecasts ?? [],
  };
  const userPrompt = renderTemplate(template.user, promptContext);
  const systemPrompt = renderTemplate(template.system, promptContext);

  const trace = startTrace({
    name: "premortem",
    input: { decisionId },
    promptVersion: PROMPT_VERSION,
  });

  const result = await generatePremortemRisks({ model: template.model, system: systemPrompt, user: userPrompt });
  if (!result.ok) {
    trace.end({ error: result.error });
    return { ok: false, errors: [result.error] };
  }
  trace.end({ riskCount: result.risks.length });

  // Re-check the draft gate: the LLM call above takes seconds, and the decision
  // could have been committed (draft->active) in the meantime. Writing risks onto
  // an active decision would desync the hashed judge input. See DATA_MODEL rule 1.
  const { data: recheck } = await service
    .from("decisions")
    .select("user_id, status")
    .eq("id", decisionId)
    .single();

  if (!recheck || recheck.user_id !== user.id) {
    return { ok: false, errors: ["Decision not found."] };
  }
  if (recheck.status !== "draft") {
    return { ok: false, errors: ["Pre-mortems can only be generated while the decision is a draft."] };
  }

  // capture the previous latest premortem *before* inserting the new one, so any
  // hand-added user risks on it can be carried forward below (regenerate must not
  // silently orphan them - see loop/QUESTIONS.md T25)
  const { data: previousPremortem } = await service
    .from("premortems")
    .select("id")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: premortem, error: insertError } = await service
    .from("premortems")
    .insert({
      user_id: user.id,
      decision_id: decisionId,
      prompt_version: PROMPT_VERSION,
      model: template.model,
      langfuse_trace_id: trace.traceId,
    })
    .select("id")
    .single();

  if (insertError || !premortem) {
    return { ok: false, errors: [insertError?.message ?? "Failed to save pre-mortem."] };
  }

  const { error: risksError } = await service.from("premortem_risks").insert(
    result.risks.map((risk) => ({
      user_id: user.id,
      premortem_id: premortem.id,
      description: risk.description,
      category: risk.category,
      severity: risk.severity,
      likelihood: risk.likelihood,
      source: "ai" as const,
    })),
  );

  if (risksError) {
    // no transaction available, so compensate manually to avoid an orphaned empty premortem
    await service.from("premortems").delete().eq("id", premortem.id);
    return { ok: false, errors: [risksError.message] };
  }

  if (previousPremortem) {
    const { data: userRisks, error: userRisksError } = await service
      .from("premortem_risks")
      .select("description, category, severity, user_id")
      .eq("premortem_id", previousPremortem.id)
      .eq("source", "user");

    if (userRisksError) {
      await service.from("premortems").delete().eq("id", premortem.id);
      return { ok: false, errors: [userRisksError.message] };
    }

    if (userRisks && userRisks.length > 0) {
      const { error: carryForwardError } = await service.from("premortem_risks").insert(
        userRisks.map((risk) => ({
          user_id: risk.user_id,
          premortem_id: premortem.id,
          description: risk.description,
          category: risk.category,
          severity: risk.severity,
          source: "user" as const,
        })),
      );

      if (carryForwardError) {
        await service.from("premortems").delete().eq("id", premortem.id);
        return { ok: false, errors: [carryForwardError.message] };
      }
    }
  }

  return { ok: true, id: premortem.id };
}

export type AddUserRiskResult = { ok: true; id: string } | { ok: false; errors: string[] };

function parseUserRiskFields(formData: FormData): {
  fields: { description: string; category: RiskCategory; severity: RiskSeverity } | null;
  errors: string[];
} {
  const errors: string[] = [];

  const description = String(formData.get("description") ?? "").trim();
  if (!description) errors.push("Description is required.");

  const category = String(formData.get("category") ?? "");
  if (!RISK_CATEGORIES.includes(category as RiskCategory)) errors.push("A valid category is required.");

  const severity = String(formData.get("severity") ?? "");
  if (!RISK_SEVERITIES.includes(severity as RiskSeverity)) errors.push("A valid severity is required.");

  if (errors.length > 0) return { fields: null, errors };
  return {
    fields: { description, category: category as RiskCategory, severity: severity as RiskSeverity },
    errors: [],
  };
}

// risks are judge input (DATA_MODEL integrity rule 1) — user-added risks only writable while
// the parent decision is a draft; ownership is checked via the premortem row, not the decision
// row, since a premortem_id doesn't imply the caller owns it (historical IDOR — docs/EVIDENCE.md)
export async function addUserRisk(premortemId: string, formData: FormData): Promise<AddUserRiskResult> {
  const { fields, errors } = parseUserRiskFields(formData);
  if (!fields) return { ok: false, errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["Not signed in."] };

  const service = createServiceClient();
  const { data: premortem, error: premortemError } = await service
    .from("premortems")
    .select("user_id, decision_id")
    .eq("id", premortemId)
    .single();

  if (premortemError || !premortem || premortem.user_id !== user.id) {
    return { ok: false, errors: ["Pre-mortem not found."] };
  }

  const { data: decision, error: decisionError } = await service
    .from("decisions")
    .select("status")
    .eq("id", premortem.decision_id)
    .single();

  if (decisionError || !decision || decision.status !== "draft") {
    return { ok: false, errors: ["Risks can only be added while the decision is a draft."] };
  }

  // a regenerate in another tab can leave this premortemId pointing at an inert
  // history row - writing there would silently vanish from the rendered panel
  const { data: latestPremortem } = await service
    .from("premortems")
    .select("id")
    .eq("decision_id", premortem.decision_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestPremortem || latestPremortem.id !== premortemId) {
    return { ok: false, errors: ["This pre-mortem has been regenerated — reload the page."] };
  }

  const { data, error } = await service
    .from("premortem_risks")
    .insert({
      user_id: user.id,
      premortem_id: premortemId,
      description: fields.description,
      category: fields.category,
      severity: fields.severity,
      source: "user" as const,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, errors: [error?.message ?? "Failed to save risk."] };
  }
  return { ok: true, id: data.id };
}
