import { createServiceClient } from "@/lib/supabase/service";
import { hasAnthropicKey } from "@/lib/llm/client";
import { generateJudgeScores, hashJudgeInput, type JudgeInput } from "@/lib/llm/judge";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/template";
import { startTrace } from "@/lib/llm/tracing";

const PROMPT_VERSION = "judge_v1";
const RUBRIC_VERSION = "v1"; // JUDGE_RUBRIC.md version; traced alongside prompt_version per §Protocol

// DATA_MODEL integrity rule 3 — select only decision-time, outcome-free fields.
// Kept as its own function so a test can assert the payload never carries an
// outcome-shaped key, independent of whatever the DB happens to return.
export function assembleJudgeInput(params: {
  decision: {
    title: string;
    context: string;
    rationale: string | null;
    options_considered: unknown;
    chosen_option: string | null;
    stakes: string;
    reversibility: string;
  };
  forecasts: { question: string; probability: number; desired: boolean }[];
  risks: { description: string; category: string; severity: string; source: string }[];
}): JudgeInput {
  const options = Array.isArray(params.decision.options_considered)
    ? (params.decision.options_considered as string[])
    : [];

  return {
    title: params.decision.title,
    context: params.decision.context,
    rationale: params.decision.rationale ?? "(none given)",
    options_considered: options,
    chosen_option: params.decision.chosen_option ?? "(not chosen)",
    stakes: params.decision.stakes,
    reversibility: params.decision.reversibility,
    forecasts: params.forecasts,
    risks: params.risks,
  };
}

// best-effort, called right after a decision commits: failures here are logged
// and swallowed rather than surfaced, mirroring T29's scheduleCheckinReminders —
// the commit itself has already succeeded and judge scoring isn't user-blocking.
export async function runJudge(decisionId: string): Promise<void> {
  if (!hasAnthropicKey()) return;

  try {
    const service = createServiceClient();
    const { data: decision, error: decisionError } = await service
      .from("decisions")
      .select("user_id, title, context, rationale, options_considered, chosen_option, stakes, reversibility")
      .eq("id", decisionId)
      .single();

    if (decisionError || !decision) {
      console.error("runJudge: decision not found", decisionId, decisionError);
      return;
    }

    const { data: forecasts } = await service
      .from("forecasts")
      .select("question, probability, desired")
      .eq("decision_id", decisionId)
      .order("created_at")
      .order("id");

    // judge input is scoped to the chosen option's premortem only (DATA_MODEL rule 3,
    // T58) - null chosen_option is the legacy/single-option path, same as the null-option
    // premortem, so pre-P10 decisions hash identically. Non-chosen options' premortems
    // are retained as the decision-time record but never selected here.
    const premortemQuery = service.from("premortems").select("id").eq("decision_id", decisionId);
    const { data: premortem } = await (decision.chosen_option
      ? premortemQuery.eq("option", decision.chosen_option)
      : premortemQuery.is("option", null)
    )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: risks } = premortem
      ? await service
          .from("premortem_risks")
          .select("description, category, severity, source")
          .eq("premortem_id", premortem.id)
          .order("created_at")
          .order("id")
      : { data: [] as { description: string; category: string; severity: string; source: string }[] };

    const input = assembleJudgeInput({
      decision,
      forecasts: forecasts ?? [],
      risks: risks ?? [],
    });
    const inputHash = hashJudgeInput(input);

    const template = await loadPromptTemplate(PROMPT_VERSION);
    const promptContext = { ...input, options_considered: input.options_considered.join(", ") };
    const systemPrompt = renderTemplate(template.system, promptContext);
    const userPrompt = renderTemplate(template.user, promptContext);

    const trace = startTrace({ name: "judge", input: { decisionId }, promptVersion: PROMPT_VERSION, rubricVersion: RUBRIC_VERSION });

    const result = await generateJudgeScores({ model: template.model, system: systemPrompt, user: userPrompt });
    if (!result.ok) {
      trace.end({ error: result.error });
      console.error("runJudge: judge call failed", decisionId, result.error);
      return;
    }
    trace.end({ scores: result.scores, contamination: result.contamination });

    // the judge is meant to be outcome-blind by construction (ADR-3) — if it still
    // reports contamination, input assembly leaked and needs investigating
    if (result.contamination) {
      console.warn("runJudge: judge flagged contamination", decisionId);
    }

    const { error: insertError } = await service.from("judge_scores").insert({
      user_id: decision.user_id,
      decision_id: decisionId,
      prompt_version: PROMPT_VERSION,
      model: template.model,
      input_hash: inputHash,
      scores: result.scores,
      rationale: { rationale: result.rationale, evidence_spans: result.evidenceSpans },
      contamination: result.contamination,
      langfuse_trace_id: trace.traceId,
    });

    if (insertError) console.error("runJudge: failed to persist judge_scores", decisionId, insertError);
  } catch (err) {
    console.error("runJudge failed", decisionId, err);
  }
}
