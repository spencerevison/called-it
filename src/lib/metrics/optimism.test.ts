import { describe, expect, it } from "vitest";
import { optimismBias } from "./optimism";

// Vector transcribed verbatim from METRICS.md M4.
describe("optimismBias (M4)", () => {
  it("computes mean(p) - mean(o) over desired forecasts", () => {
    const result = optimismBias([
      { p: 0.8, o: 1 },
      { p: 0.7, o: 0 },
      { p: 0.9, o: 1 },
      { p: 0.72, o: 0 },
    ]);
    expect(result.value).toBeCloseTo(0.28, 9);
    expect(result.n).toBe(4);
  });

  it("empty input -> null value, n=0", () => {
    const result = optimismBias([]);
    expect(result.value).toBeNull();
    expect(result.n).toBe(0);
  });
});
