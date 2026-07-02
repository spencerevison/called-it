import { describe, expect, it } from "vitest";
import { horizonGap } from "./horizonGap";

// Vector transcribed verbatim from METRICS.md M6.
describe("horizonGap (M6)", () => {
  it("computes brier(long) - brier(short), excluding 31-90d", () => {
    const result = horizonGap([
      { p: 0.8, o: 1, horizonDays: 10 },
      { p: 0.3, o: 0, horizonDays: 20 },
      { p: 0.9, o: 0, horizonDays: 120 },
      { p: 0.6, o: 1, horizonDays: 150 },
    ]);
    expect(result.gap).toBeCloseTo(0.42, 9);
    expect(result.shortN).toBe(2);
    expect(result.longN).toBe(2);
  });

  it("31-90d forecasts excluded from both sides", () => {
    const result = horizonGap([
      { p: 0.8, o: 1, horizonDays: 10 },
      { p: 0.5, o: 1, horizonDays: 60 },
      { p: 0.9, o: 0, horizonDays: 120 },
    ]);
    expect(result.shortN).toBe(1);
    expect(result.longN).toBe(1);
  });

  it("missing a side -> null gap, counts still returned", () => {
    const result = horizonGap([{ p: 0.8, o: 1, horizonDays: 10 }]);
    expect(result.gap).toBeNull();
    expect(result.shortN).toBe(1);
    expect(result.longN).toBe(0);
  });
});
