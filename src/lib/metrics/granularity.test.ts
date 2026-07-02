import { describe, expect, it } from "vitest";
import { confidenceGranularity } from "./granularity";

// Vector transcribed verbatim from METRICS.md M5.
describe("confidenceGranularity (M5)", () => {
  it("computes round10/round5/fifty rates", () => {
    const result = confidenceGranularity([0.7, 0.65, 0.5, 0.72, 0.9]);
    expect(result.round10Rate).toBeCloseTo(0.6, 9);
    expect(result.round5Rate).toBeCloseTo(0.8, 9);
    expect(result.fiftyRate).toBeCloseTo(0.2, 9);
    expect(result.n).toBe(5);
  });

  it("empty input -> zero rates, n=0", () => {
    const result = confidenceGranularity([]);
    expect(result.round10Rate).toBe(0);
    expect(result.round5Rate).toBe(0);
    expect(result.fiftyRate).toBe(0);
    expect(result.n).toBe(0);
  });
});
