import type { GoldsetEntry } from "@/lib/eval/goldset";

// T42 — decision-time-only prompt context for a gold-set entry, mirrors
// premortem-actions.ts's context shape (options_considered joined at render time
// by the caller, same as eval-judge.mjs does for the judge prompt).
const HORIZON_MONTHS = 6;

export function buildPremortemPromptContext(entry: GoldsetEntry) {
  return {
    title: entry.decision.title,
    context: entry.decision.context,
    options_considered: entry.decision.options_considered,
    chosen_option: entry.decision.chosen_option,
    rationale: entry.decision.rationale,
    stakes: entry.decision.stakes,
    reversibility: entry.decision.reversibility,
    horizon_months: HORIZON_MONTHS,
    forecasts: entry.forecasts.map((f) => ({ question: f.question, probability: f.probability, desired: f.desired })),
  };
}

// A match target is one thing a generated risk can be matched against: a
// knowable check-in failure (feeds the M10-style surface rate) or one of the
// human's expected_premortem_risks (broader superset per EVAL_PLAN §2 — its
// own coverage stat, not part of the primary surface rate).
export type MatchTarget = { kind: "failure"; index: number; text: string } | { kind: "expected"; index: number; text: string };

export function buildMatchTargets(entry: GoldsetEntry): MatchTarget[] {
  const failures: MatchTarget[] = entry.outcome.failures
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.was_knowable)
    .map(({ f, index }) => ({ kind: "failure" as const, index, text: f.description }));
  const expected: MatchTarget[] = entry.human_labels.expected_premortem_risks.map((text, index) => ({
    kind: "expected" as const,
    index,
    text,
  }));
  return [...failures, ...expected];
}

// persisted matching-session key — re-running the same prompt version reuses
// the human's prior calls instead of re-prompting (T42 AC)
export function matchKey(itemId: string, target: MatchTarget, version: string): string {
  return `${itemId}:${target.kind}:${target.index}:${version}`;
}

export type ItemMatchResult = { itemId: string; risksGenerated: number; targets: { target: MatchTarget; matched: boolean }[] };

// M10-style surface rate — per-failure primary, per-decision companion —
// computed only over "failure" targets; "expected" targets are reported separately.
export function computeSurfaceRate(items: ItemMatchResult[]): { perFailure: number | null; perDecision: number | null } {
  const failureResults = items.map((item) => item.targets.filter((t) => t.target.kind === "failure"));
  const allFailures = failureResults.flat();
  if (allFailures.length === 0) return { perFailure: null, perDecision: null };

  const perFailure = allFailures.filter((t) => t.matched).length / allFailures.length;

  const decisionsWithFailures = failureResults.filter((fs) => fs.length > 0);
  const perDecision =
    decisionsWithFailures.length === 0
      ? null
      : decisionsWithFailures.filter((fs) => fs.some((t) => t.matched)).length / decisionsWithFailures.length;

  return { perFailure, perDecision };
}

export function computeExpectedCoverage(items: ItemMatchResult[]): number | null {
  const expected = items.flatMap((item) => item.targets.filter((t) => t.target.kind === "expected"));
  if (expected.length === 0) return null;
  return expected.filter((t) => t.matched).length / expected.length;
}

// Committed report: aggregate metrics + item ids ONLY (EVAL_PLAN privacy rule)
// — no risk/failure text, ever, in this string.
export function renderPremortemReport(params: {
  version: string;
  date: string;
  itemIds: string[];
  surfaceRate: { perFailure: number | null; perDecision: number | null };
  expectedCoverage: number | null;
  meanRisksGenerated: number;
}): string {
  const { version, date, itemIds, surfaceRate, expectedCoverage, meanRisksGenerated } = params;
  const fmt = (n: number | null) => (n === null ? "insufficient data" : n.toFixed(3));

  return `# Pre-mortem surface rate — ${version} (${date})

n = ${itemIds.length}
item ids: ${itemIds.join(", ")}

| metric | value |
|---|---|
| surface rate (per-failure) | ${fmt(surfaceRate.perFailure)} |
| surface rate (per-decision) | ${fmt(surfaceRate.perDecision)} |
| expected-risk coverage | ${fmt(expectedCoverage)} |
| mean risks generated / item | ${meanRisksGenerated.toFixed(2)} |
`;
}
