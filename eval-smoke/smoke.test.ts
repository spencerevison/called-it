import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseGoldsetEntry } from "@/lib/eval/goldset";
import { assembleJudgeInputFromGoldset, findDisagreements, renderJudgeReport } from "@/lib/eval/judge-run";
import { computeAgreement } from "@/lib/eval/agreement";
import { loadPromptTemplate, renderTemplate } from "@/lib/prompts/template";

// T44 — CI eval smoke: import -> judge -> report against 3 synthetic fixtures,
// entirely in-memory (no DB) with the LLM call mocked (zero live calls). Mock
// responses below are keyed by fixture order (see goldset/fixtures/*.json
// _note headers), not request content, so the mock stays trivial.
const MOCK_RESPONSES = [
  // fixture-001 (gs-fixture-a): exact match, diff 0 on every dim
  { scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 4 } },
  // fixture-002 (gs-fixture-b): within1 but not exact, diff 1 on every dim
  { scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 4 } },
  // fixture-003 (gs-fixture-c): disagreement, diff 3 on every dim
  { scores: { risk_comprehensiveness: 4, calibration_given_knowable: 2, process_quality: 5 } },
];

const rationale = {
  risk_comprehensiveness: "mocked rationale",
  calibration_given_knowable: "mocked rationale",
  process_quality: "mocked rationale",
};

vi.mock("@/lib/llm/client", () => ({ generateText: vi.fn() }));

import { generateText } from "@/lib/llm/client";
import { generateJudgeScores } from "@/lib/llm/judge";

describe("eval smoke (T44)", () => {
  it("runs import -> judge -> report with zero live LLM calls", async () => {
    // import: validate the 3 fixtures the same way eval-import.mjs validates goldset/*.json
    const fixturesDir = path.join(process.cwd(), "goldset", "fixtures");
    const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort();
    expect(files.length).toBe(3);
    const entries = files.map((f) => parseGoldsetEntry(readFileSync(path.join(fixturesDir, f), "utf-8"), f));

    let call = 0;
    vi.mocked(generateText).mockImplementation(async () =>
      JSON.stringify({ ...MOCK_RESPONSES[call++], rationale, evidence_spans: [], contamination: false }),
    );

    // judge: same assembly + scoring path as eval-judge.mjs, driven in-memory.
    // for-of (not Promise.all) so mock call order stays pinned to fixture order.
    const template = await loadPromptTemplate("judge_v1");
    const judged = [];
    for (const entry of entries) {
      const input = assembleJudgeInputFromGoldset(entry);
      const promptContext = { ...input, options_considered: input.options_considered.join(", ") };
      const system = renderTemplate(template.system, promptContext);
      const user = renderTemplate(template.user, promptContext);
      const result = await generateJudgeScores({ model: template.model, system, user });
      if (!result.ok) throw new Error(result.error);
      judged.push({
        itemId: entry.id,
        human: entry.human_labels.judge_scores,
        humanRationale: entry.human_labels.score_rationales,
        judge: result.scores,
        judgeRationale: result.rationale,
      });
    }

    // zero live calls — every score came from the mock, never a real network hit
    expect(generateText).toHaveBeenCalledTimes(3);

    // report: hand-computed agreement (diffs 0/1/3 per dim across the 3 fixtures)
    const agreement = computeAgreement(judged);
    for (const dim of ["risk_comprehensiveness", "calibration_given_knowable", "process_quality"] as const) {
      expect(agreement.perDimension[dim]).toEqual({ within1: 2 / 3, exact: 1 / 3, mae: 4 / 3 });
    }
    expect(agreement.macroWithin1).toBeCloseTo(2 / 3);

    const disagreements = findDisagreements(judged);
    expect(disagreements.length).toBe(3); // gs-fixture-c only, all 3 dims outside within1
    expect(disagreements.every((d) => d.itemId === "gs-fixture-c")).toBe(true);

    const report = renderJudgeReport({
      version: "judge_v1",
      date: "2026-01-01",
      itemIds: entries.map((e) => e.id),
      agreement,
    });
    expect(report).toContain("gs-fixture-a");
    // content-free per EVAL_PLAN privacy rule — no decision content leaks into the report
    for (const entry of entries) expect(report).not.toContain(entry.decision.title);
  });
});
