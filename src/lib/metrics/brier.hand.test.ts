import { describe, expect, it } from "vitest";
import { brier } from "./brier";

// Vectors transcribed verbatim from METRICS.md M1. [HAND] stub throws until
// Spence implements -- these specs are meant to fail under `pnpm test:hand`.
describe("brier (M1)", () => {
  it("Vector A: mixed calls", () => {
    const forecasts = [
      { p: 0.9, o: 1 as const },
      { p: 0.6, o: 1 as const },
      { p: 0.2, o: 0 as const },
      { p: 0.5, o: 0 as const },
    ];
    expect(brier(forecasts)).toBeCloseTo(0.115, 9);
  });

  it("Vector B: empty input -> null, never NaN", () => {
    expect(brier([])).toBeNull();
  });
});
