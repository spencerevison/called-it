import { renderTemplate, type PromptTemplate } from "@/lib/prompts/template";
import { startTrace } from "@/lib/llm/tracing";
import { JUDGE_DIMENSIONS, type JudgeDimension, type JudgeScores } from "@/lib/llm/judge";
import { assembleJudgeInputFromGoldset, evalTraceTags, type JudgeScoreFn } from "@/lib/eval/judge-run";
import type { GoldsetEntry } from "@/lib/eval/goldset";

export type Valence = "good" | "bad";

// METRICS.md's M9 valence rule (majority of forecasts resolved desired = good,
// ties = bad, conservative) — reused here rather than a new definition since
// EVAL_PLAN just says "outcome-valence" without redefining it.
export function computeValence(entry: GoldsetEntry): Valence {
  if (entry.forecasts.length === 0) return "bad";
  const desiredCount = entry.forecasts.filter((f) => f.outcome === f.desired).length;
  return desiredCount > entry.forecasts.length / 2 ? "good" : "bad";
}

function renderPair(template: PromptTemplate, context: Record<string, unknown>) {
  return { system: renderTemplate(template.system, context), user: renderTemplate(template.user, context) };
}

// blind context is identical to T41's assembleJudgeInputFromGoldset; the aware
// variant just tacks the outcome on top for the {{outcome_summary}}/{{#failures}}
// section in judge_v1_aware.md's user template.
function awareContext(entry: GoldsetEntry) {
  const blind = assembleJudgeInputFromGoldset(entry);
  return {
    ...blind,
    options_considered: blind.options_considered.join(", "),
    outcome_summary: entry.outcome.summary,
    failures: entry.outcome.failures,
  };
}

export type ContaminationItem = { itemId: string; valence: Valence; blind: JudgeScores; aware: JudgeScores };

// Judges every entry twice — once blind, once outcome-aware — so a delta can
// be computed per item. Two scoreFn calls per entry, each its own trace.
export async function judgeContaminationPair(params: {
  entries: GoldsetEntry[];
  blindTemplate: PromptTemplate;
  awareTemplate: PromptTemplate;
  version: string;
  runId: string;
  scoreFn: JudgeScoreFn;
}): Promise<ContaminationItem[]> {
  const items: ContaminationItem[] = [];

  for (const entry of params.entries) {
    const blindInput = assembleJudgeInputFromGoldset(entry);
    const blindPrompt = renderPair(params.blindTemplate, {
      ...blindInput,
      options_considered: blindInput.options_considered.join(", "),
    });
    const awarePrompt = renderPair(params.awareTemplate, awareContext(entry));
    const tags = evalTraceTags(params.runId, params.version, entry.id);

    const blindTrace = startTrace({ name: "eval:contamination:blind", input: { itemId: entry.id }, promptVersion: params.version, tags });
    const blindResult = await params.scoreFn({ model: params.blindTemplate.model, ...blindPrompt });
    blindTrace.end(blindResult.ok ? { scores: blindResult.scores } : { error: blindResult.error });
    if (!blindResult.ok) throw new Error(`eval:contamination: item ${entry.id} blind pass failed — ${blindResult.error}`);

    const awareTrace = startTrace({ name: "eval:contamination:aware", input: { itemId: entry.id }, promptVersion: params.version, tags });
    const awareResult = await params.scoreFn({ model: params.awareTemplate.model, ...awarePrompt });
    awareTrace.end(awareResult.ok ? { scores: awareResult.scores } : { error: awareResult.error });
    if (!awareResult.ok) throw new Error(`eval:contamination: item ${entry.id} aware pass failed — ${awareResult.error}`);

    items.push({ itemId: entry.id, valence: computeValence(entry), blind: blindResult.scores, aware: awareResult.scores });
  }

  return items;
}

export type ValenceDelta = Record<JudgeDimension, number>;

function meanDelta(items: ContaminationItem[], dim: JudgeDimension): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, it) => sum + (it.aware[dim] - it.blind[dim]), 0) / items.length;
}

// mean(aware - blind) per dimension, split by outcome valence — a positive
// number means knowing a good outcome nudges the score up (and vice versa).
export function computeContaminationDelta(items: ContaminationItem[]): {
  good: ValenceDelta;
  bad: ValenceDelta;
  goodN: number;
  badN: number;
} {
  const good = items.filter((i) => i.valence === "good");
  const bad = items.filter((i) => i.valence === "bad");

  const buildDelta = (group: ContaminationItem[]): ValenceDelta => {
    const delta = {} as ValenceDelta;
    for (const dim of JUDGE_DIMENSIONS) delta[dim] = meanDelta(group, dim);
    return delta;
  };

  return { good: buildDelta(good), bad: buildDelta(bad), goodN: good.length, badN: bad.length };
}

// Committed report: aggregate deltas + item ids ONLY (EVAL_PLAN privacy rule),
// same shape as T41's renderJudgeReport.
export function renderContaminationReport(params: {
  version: string;
  date: string;
  itemIds: string[];
  delta: { good: ValenceDelta; bad: ValenceDelta; goodN: number; badN: number };
}): string {
  const { version, date, itemIds, delta } = params;
  const rows = JUDGE_DIMENSIONS.map(
    (dim) => `| ${dim} | ${delta.good[dim].toFixed(2)} | ${delta.bad[dim].toFixed(2)} |`,
  ).join("\n");

  return `# Judge contamination — ${version} (${date})

n = ${itemIds.length} (good outcome: ${delta.goodN}, bad outcome: ${delta.badN})
item ids: ${itemIds.join(", ")}

mean score delta (outcome-aware minus blind), by dimension and outcome valence:

| dimension | good outcome | bad outcome |
|---|---|---|
${rows}
`;
}
