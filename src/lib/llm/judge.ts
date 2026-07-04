import { createHash } from "node:crypto";
import { generateText } from "./client";

export const JUDGE_DIMENSIONS = ["risk_comprehensiveness", "calibration_given_knowable", "process_quality"] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

// DATA_MODEL integrity rule 3: only these fields may ever reach the judge.
// This is also the exact shape that gets hashed into judge_scores.input_hash,
// so any score stays reproducible against what the judge actually saw.
export type JudgeInput = {
  title: string;
  context: string;
  rationale: string;
  options_considered: string[];
  chosen_option: string;
  stakes: string;
  reversibility: string;
  forecasts: { question: string; probability: number; desired: boolean }[];
  risks: { description: string; category: string; severity: string; source: string }[];
};

export function hashJudgeInput(input: JudgeInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export type JudgeScores = Record<JudgeDimension, number>;
export type JudgeRationale = Record<JudgeDimension, string>;

export type ParsedJudgeResponse =
  | { ok: true; scores: JudgeScores; rationale: JudgeRationale; evidenceSpans: string[]; contamination: boolean }
  | { ok: false; error: string };

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseJudgeResponse(raw: string): ParsedJudgeResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Model response was not valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Model response must be a JSON object." };
  }
  const body = parsed as Record<string, unknown>;

  const scoresRaw = body.scores;
  if (typeof scoresRaw !== "object" || scoresRaw === null) {
    return { ok: false, error: "Model response is missing a `scores` object." };
  }
  const scores = {} as JudgeScores;
  for (const dim of JUDGE_DIMENSIONS) {
    const value = (scoresRaw as Record<string, unknown>)[dim];
    if (!isValidScore(value)) {
      return { ok: false, error: `Score for "${dim}" must be an integer 1-5.` };
    }
    scores[dim] = value;
  }

  const rationaleRaw = body.rationale;
  if (typeof rationaleRaw !== "object" || rationaleRaw === null) {
    return { ok: false, error: "Model response is missing a `rationale` object." };
  }
  const rationale = {} as JudgeRationale;
  for (const dim of JUDGE_DIMENSIONS) {
    const value = (rationaleRaw as Record<string, unknown>)[dim];
    if (typeof value !== "string" || value.trim().length === 0) {
      return { ok: false, error: `Rationale for "${dim}" must be a non-empty string.` };
    }
    rationale[dim] = value;
  }

  const evidenceSpans = body.evidence_spans;
  if (!Array.isArray(evidenceSpans) || !evidenceSpans.every((s) => typeof s === "string")) {
    return { ok: false, error: "Model response must include an `evidence_spans` array of strings." };
  }

  const contamination = body.contamination;
  if (typeof contamination !== "boolean") {
    return { ok: false, error: "Model response must include a boolean `contamination` field." };
  }

  return { ok: true, scores, rationale, evidenceSpans, contamination };
}

// a thrown SDK error (429/529/network, or client.ts "no text block") maps to the
// same {ok:false} contract the parse path returns — the caller must never reject
async function callAndParse(params: { model: string; system: string; user: string }): Promise<ParsedJudgeResponse> {
  let text: string;
  try {
    text = await generateText(params);
  } catch (err) {
    return { ok: false, error: `Model call failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  return parseJudgeResponse(text);
}

// retry-once-then-error, same contract as generatePremortemRisks (T24)
export async function generateJudgeScores(params: {
  model: string;
  system: string;
  user: string;
}): Promise<ParsedJudgeResponse> {
  const first = await callAndParse(params);
  if (first.ok) return first;

  return callAndParse({
    ...params,
    user: `${params.user}\n\nYour previous response was invalid (${first.error}). Respond again with ONLY the strict JSON object described above.`,
  });
}
