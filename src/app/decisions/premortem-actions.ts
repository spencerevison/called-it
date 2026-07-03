"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasAnthropicKey } from "@/lib/llm/client";
import { generatePremortemRisks } from "@/lib/llm/premortem";
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
  const userPrompt = renderTemplate(template.user, {
    title: decision.title,
    context: decision.context,
    options_considered: options.join(", "),
    chosen_option: decision.chosen_option ?? "(not yet chosen)",
    rationale: decision.rationale ?? "(none given)",
    stakes: decision.stakes,
    reversibility: decision.reversibility,
    horizon_months: HORIZON_MONTHS,
    forecasts: forecasts ?? [],
  });

  const trace = startTrace({
    name: "premortem",
    input: { decisionId },
    promptVersion: PROMPT_VERSION,
  });

  const result = await generatePremortemRisks({ model: template.model, system: template.system, user: userPrompt });
  if (!result.ok) {
    trace.end({ error: result.error });
    return { ok: false, errors: [result.error] };
  }
  trace.end({ riskCount: result.risks.length });

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
    return { ok: false, errors: [risksError.message] };
  }

  return { ok: true, id: premortem.id };
}
