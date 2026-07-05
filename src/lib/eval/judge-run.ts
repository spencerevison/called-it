import {
  JUDGE_DIMENSIONS,
  hashJudgeInput,
  type JudgeInput,
  type JudgeScores,
  type JudgeRationale,
  type ParsedJudgeResponse,
} from "@/lib/llm/judge";
import { renderTemplate, type PromptTemplate } from "@/lib/prompts/template";
import { startTrace } from "@/lib/llm/tracing";
import type { AgreementResult } from "@/lib/eval/agreement";
import type { GoldsetEntry } from "@/lib/eval/goldset";

// T41 — gold-set items carry no in-app pre-mortem (that's T42's premortem eval,
// a separate generation step); risks stays empty and D1 falls back to scoring
// the risk awareness present in rationale/context, per JUDGE_RUBRIC's own note.
export function assembleJudgeInputFromGoldset(entry: GoldsetEntry): JudgeInput {
  return {
    title: entry.decision.title,
    context: entry.decision.context,
    rationale: entry.decision.rationale,
    options_considered: entry.decision.options_considered,
    chosen_option: entry.decision.chosen_option,
    stakes: entry.decision.stakes,
    reversibility: entry.decision.reversibility,
    forecasts: entry.forecasts.map((f) => ({
      question: f.question,
      probability: f.probability,
      desired: f.desired,
    })),
    risks: [],
  };
}

// EVAL_PLAN §2 — every eval trace carries run_id/prompt_version/item_id so cost
// and latency are queryable per-run in Langfuse (traces can't be tagged after the fact).
export function evalTraceTags(runId: string, promptVersion: string, itemId: string): string[] {
  return [`run_id:${runId}`, `prompt_version:${promptVersion}`, `item_id:${itemId}`];
}

// the run_id tag as the compare consumer queries it — same string evalTraceTags
// emits, kept here so producer (eval-*) and consumer (eval-compare) can't drift apart.
export function runIdTag(runId: string): string {
  return `run_id:${runId}`;
}

export type JudgedItem = {
  itemId: string;
  human: JudgeScores;
  humanRationale: JudgeRationale;
  judge: JudgeScores;
  judgeRationale: JudgeRationale;
};

export type JudgeScoreFn = (params: {
  model: string;
  system: string;
  user: string;
}) => Promise<ParsedJudgeResponse>;

// The one judge-eval drive loop: assemble outcome-blind input, render the prompt,
// trace, score, accumulate. eval-judge.mjs (live scoreFn) and the CI smoke test
// (mocked scoreFn) both call this, so CI exercises the production path — not a copy
// of it (the tested-copy/live-copy split the P6/P7 gates flagged).
export async function judgeEntries(params: {
  entries: GoldsetEntry[];
  template: PromptTemplate;
  version: string;
  runId: string;
  rubricVersion: string;
  scoreFn: JudgeScoreFn;
}): Promise<{ judged: JudgedItem[]; contaminatedItemIds: string[] }> {
  const judged: JudgedItem[] = [];
  const contaminatedItemIds: string[] = [];

  for (const entry of params.entries) {
    const input = assembleJudgeInputFromGoldset(entry);
    const inputHash = hashJudgeInput(input);
    const promptContext = { ...input, options_considered: input.options_considered.join(", ") };
    const system = renderTemplate(params.template.system, promptContext);
    const user = renderTemplate(params.template.user, promptContext);

    const trace = startTrace({
      name: "eval:judge",
      input: { itemId: entry.id, inputHash },
      promptVersion: params.version,
      rubricVersion: params.rubricVersion,
      tags: evalTraceTags(params.runId, params.version, entry.id),
    });
    const result = await params.scoreFn({ model: params.template.model, system, user });
    trace.end(result.ok ? { scores: result.scores, contamination: result.contamination } : { error: result.error });

    if (!result.ok) throw new Error(`eval:judge: item ${entry.id} failed — ${result.error}`);
    if (result.contamination) contaminatedItemIds.push(entry.id);

    judged.push({
      itemId: entry.id,
      human: entry.human_labels.judge_scores,
      humanRationale: entry.human_labels.score_rationales,
      judge: result.scores,
      judgeRationale: result.rationale,
    });
  }

  return { judged, contaminatedItemIds };
}

export type DisagreementCase = {
  itemId: string;
  dimension: (typeof JUDGE_DIMENSIONS)[number];
  humanScore: number;
  humanRationale: string;
  judgeScore: number;
  judgeRationale: string;
};

// disagreement = outside within1 (|diff| > 1) — printed to stdout/docs/eval/detail
// only, never the committed report (EVAL_PLAN privacy rule).
export function findDisagreements(
  items: { itemId: string; human: JudgeScores; humanRationale: JudgeRationale; judge: JudgeScores; judgeRationale: JudgeRationale }[],
): DisagreementCase[] {
  const cases: DisagreementCase[] = [];
  for (const item of items) {
    for (const dim of JUDGE_DIMENSIONS) {
      if (Math.abs(item.human[dim] - item.judge[dim]) > 1) {
        cases.push({
          itemId: item.itemId,
          dimension: dim,
          humanScore: item.human[dim],
          humanRationale: item.humanRationale[dim],
          judgeScore: item.judge[dim],
          judgeRationale: item.judgeRationale[dim],
        });
      }
    }
  }
  return cases;
}

// Committed report: aggregate metrics + item ids ONLY (EVAL_PLAN privacy rule) —
// no decision content, no rationale text ever goes in this string.
export function renderJudgeReport(params: {
  version: string;
  date: string;
  itemIds: string[];
  agreement: AgreementResult;
  contaminatedItemIds?: string[];
}): string {
  const { version, date, itemIds, agreement, contaminatedItemIds = [] } = params;
  const rows = JUDGE_DIMENSIONS.map((dim) => {
    const a = agreement.perDimension[dim];
    return `| ${dim} | ${a.within1.toFixed(2)} | ${a.exact.toFixed(2)} | ${a.mae.toFixed(2)} |`;
  }).join("\n");

  return `# Judge agreement — ${version} (${date})

n = ${itemIds.length}
item ids: ${itemIds.join(", ")}
contaminated: ${contaminatedItemIds.length}${contaminatedItemIds.length ? ` (${contaminatedItemIds.join(", ")})` : ""}

| dimension | within1 | exact | mae |
|---|---|---|---|
${rows}

macro within1: ${agreement.macroWithin1.toFixed(2)}
`;
}
