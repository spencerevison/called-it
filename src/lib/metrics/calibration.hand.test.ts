import { describe, expect, it } from "vitest";
import { calibrationCurve } from "./calibration";

// Vector transcribed verbatim from METRICS.md M2. [HAND] stub throws until
// Spence implements -- meant to fail under `pnpm test:hand`.
describe("calibrationCurve (M2)", () => {
  it("bins the six-forecast vector", () => {
    const forecasts = [
      { p: 0.55, o: 1 as const },
      { p: 0.58, o: 0 as const },
      { p: 0.62, o: 1 as const },
      { p: 0.65, o: 1 as const },
      { p: 0.9, o: 1 as const },
      { p: 0.92, o: 0 as const },
    ];
    const bins = calibrationCurve(forecasts);

    const bin1 = bins.find((b) => b.binStart === 0.5);
    expect(bin1?.n).toBe(2);
    expect(bin1?.meanPredicted).toBeCloseTo(0.565, 9);
    expect(bin1?.observedFrequency).toBeCloseTo(0.5, 9);

    const bin2 = bins.find((b) => b.binStart === 0.6);
    expect(bin2?.n).toBe(2);
    expect(bin2?.meanPredicted).toBeCloseTo(0.635, 9);
    expect(bin2?.observedFrequency).toBeCloseTo(1.0, 9);

    const bin3 = bins.find((b) => b.binStart === 0.9);
    expect(bin3?.n).toBe(2);
    expect(bin3?.meanPredicted).toBeCloseTo(0.91, 9);
    expect(bin3?.observedFrequency).toBeCloseTo(0.5, 9);
  });
});
