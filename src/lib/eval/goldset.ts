import { z } from "zod";

// T40 — gold-set entry schema per EVAL_PLAN.md §1. Unknown keys (e.g. the
// example file's `_note`) are dropped silently since z.object() strips by
// default rather than erroring — that's the "ignores `_`-prefixed keys" AC.

const forecastSchema = z.object({
  question: z.string().min(1),
  probability: z.number().min(0).max(1),
  desired: z.boolean(),
  outcome: z.boolean(),
});

const failureSchema = z.object({
  description: z.string().min(1),
  was_knowable: z.boolean(),
});

const scoreDims = z.object({
  risk_comprehensiveness: z.number().int().min(1).max(5),
  calibration_given_knowable: z.number().int().min(1).max(5),
  process_quality: z.number().int().min(1).max(5),
});

const rationaleDims = z.object({
  risk_comprehensiveness: z.string().min(1),
  calibration_given_knowable: z.string().min(1),
  process_quality: z.string().min(1),
});

export const goldsetEntrySchema = z.object({
  id: z.string().min(1),
  decision: z.object({
    title: z.string().min(1),
    context: z.string().min(1),
    rationale: z.string().min(1),
    options_considered: z.array(z.string().min(1)).min(1),
    chosen_option: z.string().min(1),
    decided_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
    stakes: z.enum(["low", "medium", "high"]),
    reversibility: z.enum(["one_way", "two_way"]),
  }),
  forecasts: z.array(forecastSchema),
  outcome: z.object({
    summary: z.string().min(1),
    failures: z.array(failureSchema),
  }),
  human_labels: z.object({
    judge_scores: scoreDims,
    score_rationales: rationaleDims,
    expected_premortem_risks: z.array(z.string().min(1)),
  }),
});

export type GoldsetEntry = z.infer<typeof goldsetEntrySchema>;

// Parses+validates one gold-set file's raw JSON text. Throws a single error
// combining every issue, prefixed with the file name, so a broken fixture
// reports something a human can act on rather than a bare zod dump.
export function parseGoldsetEntry(raw: string, fileName: string): GoldsetEntry {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${fileName}: invalid JSON — ${(err as Error).message}`);
  }

  const result = goldsetEntrySchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${fileName}: ${issues}`);
  }
  return result.data;
}
