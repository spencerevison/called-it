// T20 — integration test for getDashboardMetrics against an in-memory fixture
// that mirrors the T12 seed dataset (scripts/seed.mjs) exactly. Expected values
// are the hand-computed ones documented in that script's header comment — this
// validates the row -> pure-function-input mapping and the min-n gating, not
// per-metric math (that's covered verbatim in index.test.ts, T13).
import { describe, expect, it } from "vitest";
import { getDashboardMetrics, type MetricsRowFetcher } from "./aggregate";

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

const fixture: MetricsRowFetcher = {
  async getDecisions() {
    return [
      { id: "d1", decidedAt: daysAgo(150), optionsConsidered: ["Stay at current job", "Take the new job"] },
      {
        id: "d2",
        decidedAt: daysAgo(100),
        optionsConsidered: ["Ship as-is", "Redesign fully", "A/B test two variants", "Delay a quarter"],
      },
      {
        id: "d3",
        decidedAt: daysAgo(140),
        optionsConsidered: ["Stay with current bank", "Switch to Bank B", "Switch to credit union"],
      },
    ];
  },
  async getDecisionEvents() {
    return [
      { decisionId: "d1", eventType: "created", createdAt: daysAgo(151) },
      { decisionId: "d1", eventType: "committed", createdAt: daysAgo(150) },
      { decisionId: "d1", eventType: "resolved", createdAt: daysAgo(5) },
      { decisionId: "d2", eventType: "created", createdAt: daysAgo(101) },
      { decisionId: "d2", eventType: "committed", createdAt: daysAgo(100) },
      { decisionId: "d2", eventType: "reversed", createdAt: daysAgo(90) },
      { decisionId: "d3", eventType: "created", createdAt: daysAgo(141) },
      { decisionId: "d3", eventType: "committed", createdAt: daysAgo(140) },
      { decisionId: "d3", eventType: "resolved", createdAt: daysAgo(3) },
    ];
  },
  async getForecasts() {
    return [
      // resolved, checkin A (d1)
      { probability: 0.9, outcome: true, resolved: true, desired: true, createdAt: daysAgo(15), resolvedAt: daysAgo(5), recalledProbability: null, resolvedInCheckinId: "A" },
      { probability: 0.6, outcome: true, resolved: true, desired: true, createdAt: daysAgo(15), resolvedAt: daysAgo(5), recalledProbability: null, resolvedInCheckinId: "A" },
      { probability: 0.2, outcome: false, resolved: true, desired: false, createdAt: daysAgo(125), resolvedAt: daysAgo(5), recalledProbability: null, resolvedInCheckinId: "A" },
      { probability: 0.5, outcome: false, resolved: true, desired: false, createdAt: daysAgo(125), resolvedAt: daysAgo(5), recalledProbability: null, resolvedInCheckinId: "A" },
      // resolved, checkin B (d3)
      { probability: 0.8, outcome: true, resolved: true, desired: true, createdAt: daysAgo(13), resolvedAt: daysAgo(3), recalledProbability: 0.85, resolvedInCheckinId: "B" },
      { probability: 0.7, outcome: false, resolved: true, desired: true, createdAt: daysAgo(123), resolvedAt: daysAgo(3), recalledProbability: null, resolvedInCheckinId: "B" },
      { probability: 0.3, outcome: true, resolved: true, desired: false, createdAt: daysAgo(123), resolvedAt: daysAgo(3), recalledProbability: 0.35, resolvedInCheckinId: "B" },
      // unresolved
      { probability: 0.5, outcome: null, resolved: false, desired: true, createdAt: daysAgo(15), resolvedAt: null, recalledProbability: null, resolvedInCheckinId: null },
      { probability: 0.65, outcome: null, resolved: false, desired: true, createdAt: daysAgo(15), resolvedAt: null, recalledProbability: null, resolvedInCheckinId: null },
      { probability: 0.72, outcome: null, resolved: false, desired: false, createdAt: daysAgo(15), resolvedAt: null, recalledProbability: null, resolvedInCheckinId: null },
      { probability: 0.4, outcome: null, resolved: false, desired: false, createdAt: daysAgo(15), resolvedAt: null, recalledProbability: null, resolvedInCheckinId: null },
      { probability: 0.55, outcome: null, resolved: false, desired: true, createdAt: daysAgo(15), resolvedAt: null, recalledProbability: null, resolvedInCheckinId: null },
    ];
  },
  async getCompletedCheckins() {
    return [
      { id: "A", overallAttribution: "skill" },
      { id: "B", overallAttribution: "luck" },
    ];
  },
  async getKnowableFailures() {
    return [
      { decisionId: "d1", linkedRiskId: "risk1" },
      { decisionId: "d1", linkedRiskId: null },
      { decisionId: "d3", linkedRiskId: "risk2" },
      { decisionId: "d3", linkedRiskId: null },
    ];
  },
};

describe("getDashboardMetrics (seed fixture)", () => {
  it("matches the T12 seed header hand-computed values", async () => {
    const m = await getDashboardMetrics("user-1", fixture);

    // M1 — n=7, below min-n=5, sufficient
    expect(m.brier.sufficient).toBe(true);
    expect(m.brier.value).toBeCloseTo(1.48 / 7, 9);

    // M2 — 7 distinct-tenth bins, n=1 each
    expect(m.calibrationCurve).toHaveLength(7);
    expect(m.calibrationCurve.every((b) => b.n === 1)).toBe(true);

    // M3 — n=2, insufficient (min 5) -> gated to null
    expect(m.hindsightBias.n).toBe(2);
    expect(m.hindsightBias.sufficient).toBe(false);
    expect(m.hindsightBias.value).toBeNull();

    // M4 — n=4 desired, insufficient (min 5) -> gated to null
    expect(m.optimismBias.desired.n).toBe(4);
    expect(m.optimismBias.desired.sufficient).toBe(false);
    expect(m.optimismBias.desired.value).toBeNull();

    // M5 — all 12 forecasts, no gating
    expect(m.granularity.n).toBe(12);
    expect(m.granularity.round10Rate).toBeCloseTo(9 / 12, 9);
    expect(m.granularity.round5Rate).toBeCloseTo(11 / 12, 9);
    expect(m.granularity.fiftyRate).toBeCloseTo(2 / 12, 9);

    // M6 — short n=3, long n=4, both below min 5 -> gated to null
    expect(m.horizonGap.shortN).toBe(3);
    expect(m.horizonGap.longN).toBe(4);
    expect(m.horizonGap.sufficient).toBe(false);
    expect(m.horizonGap.value).toBeNull();

    // M7 — 3 committed decisions, counts 2/4/3
    expect(m.optionsConsidered.n).toBe(3);
    expect(m.optionsConsidered.value).toBeCloseTo(3.0, 9);

    // M8 — 1 of 3 committed reversed, median 10 days
    expect(m.reversal.n).toBe(3);
    expect(m.reversal.value).toBeCloseTo(1 / 3, 9);
    expect(m.reversal.medianDaysToReversal).toBeCloseTo(10, 9);

    // M9 — 1 good / 1 bad checkin, insufficient (min 4/side) -> gated to null
    expect(m.selfServing.goodN).toBe(1);
    expect(m.selfServing.badN).toBe(1);
    expect(m.selfServing.sufficient).toBe(false);
    expect(m.selfServing.value).toBeNull();

    // M10 — 4 knowable failures, 2 linked; 2 decisions, both with >=1 link
    expect(m.premortemSurface.perFailure.value).toBeCloseTo(0.5, 9);
    expect(m.premortemSurface.perDecision.value).toBeCloseTo(1.0, 9);
  });
});
