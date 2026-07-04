import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGoldsetEntry } from "./goldset";
import { assembleJudgeInputFromGoldset, evalTraceTags, findDisagreements, renderJudgeReport } from "./judge-run";
import { computeAgreement } from "./agreement";

const exampleEntry = parseGoldsetEntry(
  readFileSync(path.join(process.cwd(), "goldset", "example-001.json"), "utf-8"),
  "example-001.json",
);

describe("evalTraceTags", () => {
  it("tags every eval trace with run_id, prompt_version, item_id", () => {
    expect(evalTraceTags("run-1", "judge_v1", "example-001.json")).toEqual([
      "run_id:run-1",
      "prompt_version:judge_v1",
      "item_id:example-001.json",
    ]);
  });
});

describe("assembleJudgeInputFromGoldset", () => {
  it("carries only decision-time fields + forecasts, risks empty", () => {
    const input = assembleJudgeInputFromGoldset(exampleEntry);

    expect(input.title).toBe(exampleEntry.decision.title);
    expect(input.forecasts).toEqual([
      { question: "Migration of the top three notification paths is complete within 90 days", probability: 0.75, desired: true },
      { question: "On-call pages attributed to the service drop by half within the quarter", probability: 0.6, desired: true },
      { question: "We end up doing a full rewrite anyway within 12 months", probability: 0.2, desired: false },
    ]);
    expect(input.risks).toEqual([]);

    // outcome fields must never leak into the judge input
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain("outcome");
    expect(serialized).not.toContain("was_knowable");
  });
});

describe("findDisagreements", () => {
  it("flags only dimensions where |human - judge| > 1", () => {
    const cases = findDisagreements([
      {
        itemId: "gs-001",
        human: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 1 },
        humanRationale: { risk_comprehensiveness: "h-rc", calibration_given_knowable: "h-cal", process_quality: "h-pq" },
        judge: { risk_comprehensiveness: 3, calibration_given_knowable: 5, process_quality: 4 },
        judgeRationale: { risk_comprehensiveness: "j-rc", calibration_given_knowable: "j-cal", process_quality: "j-pq" },
      },
    ]);

    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      itemId: "gs-001",
      dimension: "process_quality",
      humanScore: 1,
      judgeScore: 4,
      humanRationale: "h-pq",
      judgeRationale: "j-pq",
    });
  });
});

describe("renderJudgeReport", () => {
  it("contains only aggregate metrics + item ids, no decision/rationale content", () => {
    const agreement = computeAgreement([
      {
        itemId: exampleEntry.id,
        human: exampleEntry.human_labels.judge_scores,
        judge: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 3 },
      },
    ]);

    const report = renderJudgeReport({
      version: "judge_v1",
      date: "2026-07-04",
      itemIds: [exampleEntry.id],
      agreement,
    });

    expect(report).toContain(exampleEntry.id);
    expect(report).toContain("within1");
    expect(report).not.toContain(exampleEntry.decision.title);
    expect(report).not.toContain(exampleEntry.decision.context);
    for (const rationale of Object.values(exampleEntry.human_labels.score_rationales)) {
      expect(report).not.toContain(rationale);
    }
  });

  it("surfaces contaminated item ids so a contaminated run is distinguishable in the audit trail", () => {
    const agreement = computeAgreement([
      {
        itemId: exampleEntry.id,
        human: exampleEntry.human_labels.judge_scores,
        judge: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 3 },
      },
    ]);

    const clean = renderJudgeReport({ version: "judge_v1", date: "2026-07-04", itemIds: [exampleEntry.id], agreement });
    expect(clean).toContain("contaminated: 0");

    const flagged = renderJudgeReport({
      version: "judge_v1",
      date: "2026-07-04",
      itemIds: [exampleEntry.id],
      agreement,
      contaminatedItemIds: [exampleEntry.id],
    });
    expect(flagged).toContain(`contaminated: 1 (${exampleEntry.id})`);
  });
});
