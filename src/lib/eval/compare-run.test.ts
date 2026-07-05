import { describe, expect, it } from "vitest";
import { computeCostLatencyStats, computeDeltaRows, renderCompareReport, type VersionRunStats } from "./compare-run";

describe("computeCostLatencyStats", () => {
  it("returns null for both stats when there are no traces", () => {
    expect(computeCostLatencyStats([])).toEqual({ costPerItem: null, p50LatencyMs: null });
  });

  it("computes mean cost and median latency (odd count) from mocked Langfuse traces", () => {
    const traces = [
      { totalCost: 0.01, latency: 1 },
      { totalCost: 0.03, latency: 3 },
      { totalCost: 0.02, latency: 2 },
    ];
    const stats = computeCostLatencyStats(traces);
    expect(stats.costPerItem).toBeCloseTo(0.02, 5);
    expect(stats.p50LatencyMs).toBe(2000);
  });

  it("computes median latency for an even count as the midpoint average", () => {
    const traces = [
      { totalCost: 0.01, latency: 1 },
      { totalCost: 0.01, latency: 2 },
      { totalCost: 0.01, latency: 3 },
      { totalCost: 0.01, latency: 4 },
    ];
    expect(computeCostLatencyStats(traces).p50LatencyMs).toBe(2500);
  });
});

describe("computeDeltaRows / renderCompareReport", () => {
  const v1: VersionRunStats = {
    version: "premortem_v1",
    surfaceRatePerFailure: 0.5,
    surfaceRatePerDecision: 0.6,
    meanRisksGenerated: 4,
    costPerItem: 0.01,
    p50LatencyMs: 1200,
  };
  const v2: VersionRunStats = {
    version: "premortem_v2",
    surfaceRatePerFailure: 0.625,
    surfaceRatePerDecision: 0.8,
    meanRisksGenerated: 5,
    costPerItem: 0.015,
    p50LatencyMs: 1500,
  };

  it("computes a positive delta when v2 improves on v1", () => {
    const rows = computeDeltaRows(v1, v2);
    const surfaceRow = rows.find((r) => r.metric === "surface rate (per-failure)");
    expect(surfaceRow).toEqual({ metric: "surface rate (per-failure)", a: "0.500", b: "0.625", delta: "+0.125" });
  });

  it("renders n/a when a version's stat is missing (no matching Langfuse traces)", () => {
    const noStats: VersionRunStats = { ...v1, costPerItem: null, p50LatencyMs: null };
    const rows = computeDeltaRows(noStats, v2);
    const costRow = rows.find((r) => r.metric === "cost / item (USD)");
    expect(costRow).toEqual({ metric: "cost / item (USD)", a: "n/a", b: "0.0150", delta: "n/a" });
  });

  it("renders a content-free markdown table with both version headers", () => {
    const report = renderCompareReport({ kind: "premortem", date: "2026-07-04", a: v1, b: v2 });
    expect(report).toContain("premortem compare — premortem_v1 vs premortem_v2 (2026-07-04)");
    expect(report).toContain("| premortem_v1 | premortem_v2 | delta |");
    expect(report).toContain("mean risks generated / item");
  });
});
