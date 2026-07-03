import { generateText } from "./client";

const CATEGORIES = ["execution", "external", "information", "motivated_reasoning", "second_order"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

export type RiskCategory = (typeof CATEGORIES)[number];
export type RiskSeverity = (typeof SEVERITIES)[number];

export type PremortemRisk = {
  description: string;
  category: RiskCategory;
  severity: RiskSeverity;
  likelihood: number | null;
};

export type ParsedPremortemResponse = { ok: true; risks: PremortemRisk[] } | { ok: false; error: string };

// keep validation loose on likelihood (nullable per DATA_MODEL) but strict on
// everything the JUDGE/dashboard code actually branches on
export function parsePremortemResponse(raw: string): ParsedPremortemResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Model response was not valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null || !("risks" in parsed)) {
    return { ok: false, error: "Model response is missing a `risks` array." };
  }
  const risks = (parsed as { risks: unknown }).risks;
  if (!Array.isArray(risks) || risks.length < 6 || risks.length > 12) {
    return { ok: false, error: "Model response must contain 6-12 risks." };
  }

  const validated: PremortemRisk[] = [];
  for (const risk of risks) {
    if (typeof risk !== "object" || risk === null) {
      return { ok: false, error: "Each risk must be an object." };
    }
    const r = risk as Record<string, unknown>;
    if (typeof r.description !== "string" || r.description.trim().length === 0) {
      return { ok: false, error: "Each risk needs a non-empty description." };
    }
    if (!CATEGORIES.includes(r.category as RiskCategory)) {
      return { ok: false, error: `Invalid risk category: ${String(r.category)}` };
    }
    if (!SEVERITIES.includes(r.severity as RiskSeverity)) {
      return { ok: false, error: `Invalid risk severity: ${String(r.severity)}` };
    }
    const likelihood = typeof r.likelihood === "number" ? r.likelihood : null;
    if (likelihood !== null && (likelihood < 0 || likelihood > 1)) {
      return { ok: false, error: "Likelihood must be between 0 and 1." };
    }
    validated.push({
      description: r.description.trim(),
      category: r.category as RiskCategory,
      severity: r.severity as RiskSeverity,
      likelihood,
    });
  }

  return { ok: true, risks: validated };
}

// a thrown SDK error (429/529/network, or client.ts "no text block") maps to the
// same {ok:false} contract the parse path returns — the server action must never reject
async function callAndParse(params: { model: string; system: string; user: string }): Promise<ParsedPremortemResponse> {
  let text: string;
  try {
    text = await generateText(params);
  } catch (err) {
    return { ok: false, error: `Model call failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  return parsePremortemResponse(text);
}

// retry-once-then-error per T24 AC: a bad first attempt (malformed response OR a
// transport throw) gets exactly one corrective re-prompt before giving up
export async function generatePremortemRisks(params: {
  model: string;
  system: string;
  user: string;
}): Promise<ParsedPremortemResponse> {
  const first = await callAndParse(params);
  if (first.ok) return first;

  return callAndParse({
    ...params,
    user: `${params.user}\n\nYour previous response was invalid (${first.error}). Respond again with ONLY the strict JSON object described above.`,
  });
}
