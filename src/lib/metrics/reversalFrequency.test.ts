import { describe, expect, it } from "vitest";
import { reversalFrequency } from "./reversalFrequency";

// Vector transcribed verbatim from METRICS.md M8.
describe("reversalFrequency (M8)", () => {
  it("10 committed decisions, 3 reversed -> 0.30", () => {
    const decisions = [
      { reversed: true, daysToReversal: 10 },
      { reversed: true, daysToReversal: 20 },
      { reversed: true, daysToReversal: 30 },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
      { reversed: false, daysToReversal: null },
    ];
    const result = reversalFrequency(decisions);
    expect(result.rate).toBeCloseTo(0.3, 9);
    expect(result.n).toBe(10);
    expect(result.medianDaysToReversal).toBe(20);
  });

  it("empty input -> null rate, n=0", () => {
    const result = reversalFrequency([]);
    expect(result.rate).toBeNull();
    expect(result.n).toBe(0);
    expect(result.medianDaysToReversal).toBeNull();
  });
});
