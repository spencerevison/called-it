import { describe, it, expect } from "vitest";
import { computeSurfaceRate, computeExpectedCoverage, matchKey, type ItemMatchResult, type MatchTarget } from "@/lib/eval/premortem-run";

function failure(index: number, matched: boolean): { target: MatchTarget; matched: boolean } {
  return { target: { kind: "failure", index, text: `f${index}` }, matched };
}

describe("computeSurfaceRate", () => {
  // METRICS.md M10 vector: 5 decisions, 8 knowable failures total, 5 linked
  // -> per-failure 0.625; 4 of 5 decisions had >=1 link -> per-decision 0.8
  it("matches the M10 vector exactly", () => {
    const items: ItemMatchResult[] = [
      { itemId: "d1", risksGenerated: 8, targets: [failure(0, true), failure(1, false)] },
      { itemId: "d2", risksGenerated: 8, targets: [failure(0, true)] },
      { itemId: "d3", risksGenerated: 8, targets: [failure(0, true), failure(1, false)] },
      { itemId: "d4", risksGenerated: 8, targets: [failure(0, true), failure(1, true)] },
      { itemId: "d5", risksGenerated: 8, targets: [failure(0, false)] },
    ];

    const { perFailure, perDecision } = computeSurfaceRate(items);
    expect(perFailure).toBeCloseTo(0.625);
    expect(perDecision).toBeCloseTo(0.8);
  });

  it("returns null (insufficient data) when no item has a knowable failure", () => {
    const items: ItemMatchResult[] = [{ itemId: "d1", risksGenerated: 8, targets: [] }];
    expect(computeSurfaceRate(items)).toEqual({ perFailure: null, perDecision: null });
  });
});

describe("computeExpectedCoverage", () => {
  it("shares of matched expected_premortem_risks across items", () => {
    const items: ItemMatchResult[] = [
      {
        itemId: "d1",
        risksGenerated: 8,
        targets: [
          { target: { kind: "expected", index: 0, text: "e0" }, matched: true },
          { target: { kind: "expected", index: 1, text: "e1" }, matched: false },
        ],
      },
    ];
    expect(computeExpectedCoverage(items)).toBeCloseTo(0.5);
  });

  it("returns null when no item has an expected risk target", () => {
    expect(computeExpectedCoverage([{ itemId: "d1", risksGenerated: 8, targets: [] }])).toBeNull();
  });
});

describe("matchKey", () => {
  it("keys by item, target kind, index, and prompt version so re-runs of the same version reuse matches", () => {
    const target: MatchTarget = { kind: "failure", index: 2, text: "whatever" };
    expect(matchKey("gs-001", target, "premortem_v1")).toBe("gs-001:failure:2:premortem_v1");
  });
});
