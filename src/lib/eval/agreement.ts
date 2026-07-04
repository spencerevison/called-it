import { JUDGE_DIMENSIONS, type JudgeDimension, type JudgeScores } from "@/lib/llm/judge";

// T41 — agreement math per JUDGE_RUBRIC.md §Agreement definition. within1/exact
// are share-of-items (bar is on within1, per dimension); mae is mean abs diff.
export type DimensionAgreement = { within1: number; exact: number; mae: number };
export type AgreementResult = {
  perDimension: Record<JudgeDimension, DimensionAgreement>;
  macroWithin1: number;
};

export function computeAgreement(
  items: { itemId: string; human: JudgeScores; judge: JudgeScores }[],
): AgreementResult {
  if (items.length === 0) throw new Error("computeAgreement: no items");

  const perDimension = {} as Record<JudgeDimension, DimensionAgreement>;
  for (const dim of JUDGE_DIMENSIONS) {
    const diffs = items.map((item) => Math.abs(item.human[dim] - item.judge[dim]));
    const within1 = diffs.filter((d) => d <= 1).length / diffs.length;
    const exact = diffs.filter((d) => d === 0).length / diffs.length;
    const mae = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    perDimension[dim] = { within1, exact, mae };
  }

  const macroWithin1 =
    JUDGE_DIMENSIONS.reduce((sum, dim) => sum + perDimension[dim].within1, 0) / JUDGE_DIMENSIONS.length;

  return { perDimension, macroWithin1 };
}
