import type { JudgeDimension } from "./judge";

// Static reference copy of JUDGE_RUBRIC.md's per-dimension anchors, index 0 = score 1.
// Kept alongside the judge code (not generated from the .md) since the rubric
// only bumps versions rarely and re-review of both is already a stated process.
export const JUDGE_RUBRIC_DIMENSIONS: { key: JudgeDimension; label: string; anchors: string[] }[] = [
  {
    key: "risk_comprehensiveness",
    label: "Risk comprehensiveness",
    anchors: [
      'No risk consideration, or only generic boilerplate ("might not work out") with no decision-specific content.',
      "One or two obvious risks named; major knowable categories absent.",
      "The obvious risk categories are covered; at least one material, knowable failure mode is missing; risks are decision-specific but shallow (no severity or likelihood differentiation).",
      "All material knowable failure modes covered with decision-specific detail; little to no second-order thinking (knock-on effects, interaction between risks).",
      "Comprehensive: material knowable failure modes covered including at least one second-order effect or risk interaction; differentiated by severity/likelihood.",
    ],
  },
  {
    key: "calibration_given_knowable",
    label: "Calibration given the knowable",
    anchors: [
      "Probabilities contradict the record (e.g., 0.95 on an outcome the context describes as highly contested), or every forecast is 0.5 (no information content).",
      "Probabilities directionally plausible but insensitive to stated evidence; heavy round-number clustering with high-confidence extremes unsupported by the rationale.",
      "Probabilities broadly consistent with the record; some over- or under-confidence relative to stated uncertainty; limited differentiation across forecasts.",
      "Probabilities track the strength of stated evidence; uncertainty acknowledged where the record shows it; differentiated across forecasts.",
      "As 4, plus explicit reasoning linking evidence to probability levels (base rates, reference classes, or stated uncertainty ranges).",
    ],
  },
  {
    key: "process_quality",
    label: "Process quality",
    anchors: [
      "Single option framed as inevitable; no engagement with downsides of the chosen path.",
      "Binary yes/no framing where alternatives plausibly existed; downsides listed but not weighed.",
      "≥ 2 real options compared; tradeoffs stated; no evidence of seeking disconfirming information; reversibility not engaged.",
      "Options compared with explicit tradeoffs; at least one disconfirming consideration engaged seriously (not strawmanned); reversibility/stakes reflected in the reasoning.",
      'As 4, plus a stopping rule or kill criterion ("I\'ll reverse if X by DATE") or an explicit information-gathering step that changed the option set.',
    ],
  },
];

// scores are 1-5 ints (rubric); anchors array is 0-indexed
export function anchorFor(key: JudgeDimension, score: number): string {
  const dim = JUDGE_RUBRIC_DIMENSIONS.find((d) => d.key === key);
  return dim?.anchors[score - 1] ?? "";
}

// EVAL_PLAN §4 bar, flipped by hand once eval:judge clears it — see .env.example
export function judgeIsTrusted(): boolean {
  return process.env.JUDGE_TRUSTED === "true";
}
