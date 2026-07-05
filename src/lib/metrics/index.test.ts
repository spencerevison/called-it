import { describe, expect, it } from "vitest";
import {
  brier,
  calibrationCurve,
  confidenceGranularity,
  hindsightBias,
  horizonCalibrationGap,
  optimismBias,
  optionsConsideredCount,
  premortemSurfaceRate,
  reversalRate,
  rollingBrier,
  selfServingIndex,
} from "./index";

// M1 — Brier score
describe("brier", () => {
  it("vector A", () => {
    const forecasts = [
      { p: 0.9, o: 1 as const },
      { p: 0.6, o: 1 as const },
      { p: 0.2, o: 0 as const },
      { p: 0.5, o: 0 as const },
    ];
    const { value, n } = brier(forecasts);
    expect(value).toBeCloseTo(0.115, 9);
    expect(n).toBe(4);
  });

  it("vector B (empty)", () => {
    const { value, n } = brier([]);
    expect(value).toBeNull();
    expect(n).toBe(0);
  });
});

// M1 — Rolling Brier
describe("rollingBrier", () => {
  it("plots each point over its trailing window", () => {
    const forecasts = [
      { p: 0.9, o: 1 as const, resolvedAt: "2026-01-01" },
      { p: 0.6, o: 1 as const, resolvedAt: "2026-01-10" },
      // 200 days later — outside the first two's 90d window
      { p: 0.2, o: 0 as const, resolvedAt: "2026-07-20" },
    ];
    const points = rollingBrier(forecasts, 90);
    expect(points).toHaveLength(3);
    expect(points[0].resolvedAt).toBe("2026-01-01");
    expect(points[0].value).toBeCloseTo(0.01, 9);
    expect(points[0].n).toBe(1);
    expect(points[1].resolvedAt).toBe("2026-01-10");
    expect(points[1].value).toBeCloseTo((0.01 + 0.16) / 2, 9);
    expect(points[1].n).toBe(2);
    expect(points[2].resolvedAt).toBe("2026-07-20");
    expect(points[2].value).toBeCloseTo(0.04, 9);
    expect(points[2].n).toBe(1);
  });

  it("empty input", () => {
    expect(rollingBrier([])).toEqual([]);
  });
});

// M2 — Calibration curve
describe("calibrationCurve", () => {
  it("bins forecasts per vector", () => {
    const forecasts = [
      { p: 0.55, o: 1 as const },
      { p: 0.58, o: 0 as const },
      { p: 0.62, o: 1 as const },
      { p: 0.65, o: 1 as const },
      { p: 0.9, o: 1 as const },
      { p: 0.92, o: 0 as const },
    ];
    const bins = calibrationCurve(forecasts);
    const bin55 = bins.find((b) => b.binStart === 0.5)!;
    expect(bin55.n).toBe(2);
    expect(bin55.meanPredicted).toBeCloseTo(0.565, 9);
    expect(bin55.observedFrequency).toBeCloseTo(0.5, 9);

    const bin65 = bins.find((b) => b.binStart === 0.6)!;
    expect(bin65.n).toBe(2);
    expect(bin65.meanPredicted).toBeCloseTo(0.635, 9);
    expect(bin65.observedFrequency).toBeCloseTo(1.0, 9);

    const bin90 = bins.find((b) => b.binStart === 0.9)!;
    expect(bin90.n).toBe(2);
    expect(bin90.meanPredicted).toBeCloseTo(0.91, 9);
    expect(bin90.observedFrequency).toBeCloseTo(0.5, 9);
  });
});

// M3 — Hindsight bias coefficient
describe("hindsightBias", () => {
  it("vector", () => {
    const forecasts = [
      { p: 0.6, r: 0.8, o: 1 as const },
      { p: 0.3, r: 0.2, o: 0 as const },
    ];
    const { value, n } = hindsightBias(forecasts);
    expect(value).toBeCloseTo(0.15, 9);
    expect(n).toBe(2);
  });
});

// M4 — Optimism bias coefficient
describe("optimismBias", () => {
  it("vector", () => {
    const forecasts = [
      { p: 0.8, o: 1 as const, desired: true },
      { p: 0.7, o: 0 as const, desired: true },
      { p: 0.9, o: 1 as const, desired: true },
      { p: 0.72, o: 0 as const, desired: true },
    ];
    const { desired } = optimismBias(forecasts);
    expect(desired.value).toBeCloseTo(0.28, 9);
    expect(desired.n).toBe(4);
  });

  it("control side is null when empty", () => {
    const { control } = optimismBias([{ p: 0.5, o: 1 as const, desired: true }]);
    expect(control.value).toBeNull();
    expect(control.n).toBe(0);
  });
});

// M5 — Confidence granularity
describe("confidenceGranularity", () => {
  it("vector", () => {
    const { round10Rate, round5Rate, fiftyRate, n } = confidenceGranularity([0.7, 0.65, 0.5, 0.72, 0.9]);
    expect(round10Rate).toBeCloseTo(0.6, 9);
    expect(round5Rate).toBeCloseTo(0.8, 9);
    expect(fiftyRate).toBeCloseTo(0.2, 9);
    expect(n).toBe(5);
  });
});

// M6 — Horizon calibration gap
describe("horizonCalibrationGap", () => {
  it("vector", () => {
    const short = [
      { p: 0.8, o: 1 as const },
      { p: 0.3, o: 0 as const },
    ];
    const long = [
      { p: 0.9, o: 0 as const },
      { p: 0.6, o: 1 as const },
    ];
    const { value, shortN, longN } = horizonCalibrationGap(short, long);
    expect(value).toBeCloseTo(0.42, 9);
    expect(shortN).toBe(2);
    expect(longN).toBe(2);
  });
});

// M7 — Options-considered count
describe("optionsConsideredCount", () => {
  it("vector", () => {
    const { value, n } = optionsConsideredCount([2, 4, 3, 3]);
    expect(value).toBeCloseTo(3.0, 9);
    expect(n).toBe(4);
  });
});

// M8 — Reversal frequency
describe("reversalRate", () => {
  it("vector", () => {
    const decisions = [
      ...Array.from({ length: 3 }, () => ({ reversed: true })),
      ...Array.from({ length: 7 }, () => ({ reversed: false })),
    ];
    const { value, n } = reversalRate(decisions);
    expect(value).toBeCloseTo(0.3, 9);
    expect(n).toBe(10);
  });

  it("median days to reversal among reversed decisions", () => {
    const decisions = [
      { reversed: true, daysToReversal: 10 },
      { reversed: true, daysToReversal: 20 },
      { reversed: true, daysToReversal: 30 },
      { reversed: false },
    ];
    const { medianDaysToReversal } = reversalRate(decisions);
    expect(medianDaysToReversal).toBe(20);
  });
});

// M9 — Luck/skill attribution pattern (self-serving index)
describe("selfServingIndex", () => {
  it("vector", () => {
    const good = [
      { attribution: "skill" as const, valence: "good" as const },
      { attribution: "skill" as const, valence: "good" as const },
      { attribution: "skill" as const, valence: "good" as const },
      { attribution: "luck" as const, valence: "good" as const },
    ];
    const bad = [
      { attribution: "skill" as const, valence: "bad" as const },
      { attribution: "luck" as const, valence: "bad" as const },
      { attribution: "luck" as const, valence: "bad" as const },
      { attribution: "mixed" as const, valence: "bad" as const },
    ];
    const { value, goodN, badN } = selfServingIndex([...good, ...bad]);
    expect(value).toBeCloseTo(0.5, 9);
    expect(goodN).toBe(4);
    expect(badN).toBe(4);
  });
});

// M10 — Pre-mortem surface rate
// Vector gives only aggregates (5 decisions, 8 knowable failures, 5 linked,
// per-failure 0.625, 4/5 decisions with >=1 link) — decision grouping below
// is constructed to match those aggregates (logged in QUESTIONS.md).
describe("premortemSurfaceRate", () => {
  it("vector", () => {
    const failures = [
      { decisionId: "d1", linkedRiskId: "r1" },
      { decisionId: "d1", linkedRiskId: "r2" },
      { decisionId: "d2", linkedRiskId: "r3" },
      { decisionId: "d2", linkedRiskId: null },
      { decisionId: "d3", linkedRiskId: "r4" },
      { decisionId: "d4", linkedRiskId: "r5" },
      { decisionId: "d4", linkedRiskId: null },
      { decisionId: "d5", linkedRiskId: null },
    ];
    const { perFailure, perDecision } = premortemSurfaceRate(failures);
    expect(perFailure.value).toBeCloseTo(0.625, 9);
    expect(perFailure.n).toBe(8);
    expect(perDecision.value).toBeCloseTo(0.8, 9);
    expect(perDecision.n).toBe(5);
  });
});
