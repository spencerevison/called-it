import { describe, expect, it } from "vitest";
import { hindsightBias } from "./hindsight";

// Vector transcribed verbatim from METRICS.md M3.
describe("hindsightBias (M3)", () => {
  it("computes signed drift toward outcome", () => {
    const result = hindsightBias([
      { p: 0.6, r: 0.8, o: 1 },
      { p: 0.3, r: 0.2, o: 0 },
    ]);
    expect(result.value).toBeCloseTo(0.15, 9);
    expect(result.n).toBe(2);
  });

  it("empty input -> null value, n=0", () => {
    const result = hindsightBias([]);
    expect(result.value).toBeNull();
    expect(result.n).toBe(0);
  });
});
