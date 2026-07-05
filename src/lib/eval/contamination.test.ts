import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGoldsetEntry } from "./goldset";
import { computeContaminationDelta, computeValence, renderContaminationReport, type ContaminationItem } from "./contamination";

const exampleEntry = parseGoldsetEntry(
  readFileSync(path.join(process.cwd(), "goldset", "example-001.json"), "utf-8"),
  "example-001.json",
);

describe("computeValence", () => {
  it("is good when a majority of forecasts resolved in the desired direction", () => {
    // example-001: 2 of 3 forecasts match desired (see goldset fixture)
    expect(computeValence(exampleEntry)).toBe("good");
  });

  it("is bad on a tie (conservative), per METRICS.md's M9 rule", () => {
    const tied = {
      ...exampleEntry,
      forecasts: [
        { question: "a", probability: 0.5, desired: true, outcome: true },
        { question: "b", probability: 0.5, desired: true, outcome: false },
      ],
    };
    expect(computeValence(tied)).toBe("bad");
  });

  it("is bad when a majority missed the desired direction", () => {
    const mostlyBad = {
      ...exampleEntry,
      forecasts: [
        { question: "a", probability: 0.5, desired: true, outcome: false },
        { question: "b", probability: 0.5, desired: true, outcome: false },
        { question: "c", probability: 0.5, desired: false, outcome: true },
      ],
    };
    expect(computeValence(mostlyBad)).toBe("bad");
  });
});

describe("computeContaminationDelta", () => {
  const items: ContaminationItem[] = [
    {
      itemId: "gs-good-1",
      valence: "good",
      blind: { risk_comprehensiveness: 3, calibration_given_knowable: 3, process_quality: 3 },
      aware: { risk_comprehensiveness: 4, calibration_given_knowable: 3, process_quality: 5 },
    },
    {
      itemId: "gs-bad-1",
      valence: "bad",
      blind: { risk_comprehensiveness: 4, calibration_given_knowable: 4, process_quality: 4 },
      aware: { risk_comprehensiveness: 2, calibration_given_knowable: 4, process_quality: 3 },
    },
  ];

  it("computes mean(aware - blind) per dimension, split by valence", () => {
    const delta = computeContaminationDelta(items);
    expect(delta.good).toEqual({ risk_comprehensiveness: 1, calibration_given_knowable: 0, process_quality: 2 });
    expect(delta.bad).toEqual({ risk_comprehensiveness: -2, calibration_given_knowable: 0, process_quality: -1 });
    expect(delta.goodN).toBe(1);
    expect(delta.badN).toBe(1);
  });

  it("returns all-zero deltas for an empty valence group", () => {
    const delta = computeContaminationDelta([items[0]]);
    expect(delta.bad).toEqual({ risk_comprehensiveness: 0, calibration_given_knowable: 0, process_quality: 0 });
    expect(delta.badN).toBe(0);
  });
});

describe("renderContaminationReport", () => {
  it("contains only aggregate deltas + item ids, no decision content", () => {
    const delta = computeContaminationDelta([
      {
        itemId: exampleEntry.id,
        valence: computeValence(exampleEntry),
        blind: { risk_comprehensiveness: 3, calibration_given_knowable: 3, process_quality: 3 },
        aware: { risk_comprehensiveness: 4, calibration_given_knowable: 3, process_quality: 3 },
      },
    ]);

    const report = renderContaminationReport({
      version: "judge_v1",
      date: "2026-07-04",
      itemIds: [exampleEntry.id],
      delta,
    });

    expect(report).toContain(exampleEntry.id);
    expect(report).toContain("good outcome");
    expect(report).not.toContain(exampleEntry.decision.title);
    expect(report).not.toContain(exampleEntry.outcome.summary);
  });
});
