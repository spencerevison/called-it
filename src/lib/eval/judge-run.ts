import { JUDGE_DIMENSIONS, type JudgeInput, type JudgeScores, type JudgeRationale } from "@/lib/llm/judge";
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
}): string {
  const { version, date, itemIds, agreement } = params;
  const rows = JUDGE_DIMENSIONS.map((dim) => {
    const a = agreement.perDimension[dim];
    return `| ${dim} | ${a.within1.toFixed(2)} | ${a.exact.toFixed(2)} | ${a.mae.toFixed(2)} |`;
  }).join("\n");

  return `# Judge agreement — ${version} (${date})

n = ${itemIds.length}
item ids: ${itemIds.join(", ")}

| dimension | within1 | exact | mae |
|---|---|---|---|
${rows}

macro within1: ${agreement.macroWithin1.toFixed(2)}
`;
}
