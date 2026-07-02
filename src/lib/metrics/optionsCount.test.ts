import { describe, expect, it } from "vitest";
import { optionsCount } from "./optionsCount";

// Vector transcribed verbatim from METRICS.md M7.
describe("optionsCount (M7)", () => {
  it("computes mean options considered", () => {
    const result = optionsCount([2, 4, 3, 3]);
    expect(result.mean).toBeCloseTo(3.0, 9);
    expect(result.n).toBe(4);
  });

  it("empty input -> null mean, n=0", () => {
    const result = optionsCount([]);
    expect(result.mean).toBeNull();
    expect(result.n).toBe(0);
  });
});
