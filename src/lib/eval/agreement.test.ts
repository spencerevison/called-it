import { describe, it, expect } from "vitest";
import { computeAgreement } from "./agreement";

// hand-computed 3-item fixture per T41's AC — diffs worked out by hand below,
// not derived from the implementation.
//
// rc:  |3-3|=0, |2-4|=2, |5-5|=0  -> within1 2/3, exact 2/3, mae 2/3
// cal: |4-5|=1, |2-2|=0, |3-3|=0  -> within1 1,   exact 2/3, mae 1/3
// pq:  |2-2|=0, |4-3|=1, |1-3|=2  -> within1 2/3, exact 1/3, mae 1
// macro within1 = (2/3 + 1 + 2/3) / 3 = 7/9
const items = [
  {
    itemId: "gs-001",
    human: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 },
    judge: { risk_comprehensiveness: 3, calibration_given_knowable: 5, process_quality: 2 },
  },
  {
    itemId: "gs-002",
    human: { risk_comprehensiveness: 2, calibration_given_knowable: 2, process_quality: 4 },
    judge: { risk_comprehensiveness: 4, calibration_given_knowable: 2, process_quality: 3 },
  },
  {
    itemId: "gs-003",
    human: { risk_comprehensiveness: 5, calibration_given_knowable: 3, process_quality: 1 },
    judge: { risk_comprehensiveness: 5, calibration_given_knowable: 3, process_quality: 3 },
  },
];

describe("computeAgreement", () => {
  it("matches hand-computed within1/exact/mae per dimension", () => {
    const result = computeAgreement(items);

    expect(result.perDimension.risk_comprehensiveness.within1).toBeCloseTo(2 / 3);
    expect(result.perDimension.risk_comprehensiveness.exact).toBeCloseTo(2 / 3);
    expect(result.perDimension.risk_comprehensiveness.mae).toBeCloseTo(2 / 3);

    expect(result.perDimension.calibration_given_knowable.within1).toBeCloseTo(1);
    expect(result.perDimension.calibration_given_knowable.exact).toBeCloseTo(2 / 3);
    expect(result.perDimension.calibration_given_knowable.mae).toBeCloseTo(1 / 3);

    expect(result.perDimension.process_quality.within1).toBeCloseTo(2 / 3);
    expect(result.perDimension.process_quality.exact).toBeCloseTo(1 / 3);
    expect(result.perDimension.process_quality.mae).toBeCloseTo(1);
  });

  it("macro within1 averages the per-dimension within1s", () => {
    const result = computeAgreement(items);
    expect(result.macroWithin1).toBeCloseTo(7 / 9);
  });

  it("throws on an empty item list", () => {
    expect(() => computeAgreement([])).toThrow();
  });
});
