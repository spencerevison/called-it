import { describe, expect, it } from "vitest";
import { surfaceRate } from "./surfaceRate";

// Vector transcribed verbatim from METRICS.md M10. [HAND] stub throws until
// Spence implements -- meant to fail under `pnpm test:hand`.
describe("surfaceRate (M10)", () => {
  it("5 decisions, 8 knowable failures, 5 linked", () => {
    const failures = [
      { decisionId: "d1", linked: true },
      { decisionId: "d1", linked: true },
      { decisionId: "d2", linked: true },
      { decisionId: "d2", linked: false },
      { decisionId: "d3", linked: true },
      { decisionId: "d3", linked: false },
      { decisionId: "d4", linked: true },
      { decisionId: "d5", linked: false },
    ];
    const result = surfaceRate(failures);
    expect(result.perFailure).toBeCloseTo(0.625, 9);
    expect(result.perDecision).toBeCloseTo(0.8, 9);
  });
});
