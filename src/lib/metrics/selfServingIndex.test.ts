import { describe, expect, it } from "vitest";
import { selfServingIndex } from "./selfServingIndex";

// Vector transcribed verbatim from METRICS.md M9.
describe("selfServingIndex (M9)", () => {
  it("good: skill in 3 of 4, bad: skill in 1 of 4 -> SSI 0.50", () => {
    const checkins = [
      { attribution: "skill" as const, good: true },
      { attribution: "skill" as const, good: true },
      { attribution: "skill" as const, good: true },
      { attribution: "luck" as const, good: true },
      { attribution: "skill" as const, good: false },
      { attribution: "luck" as const, good: false },
      { attribution: "mixed" as const, good: false },
      { attribution: "luck" as const, good: false },
    ];
    const result = selfServingIndex(checkins);
    expect(result.value).toBeCloseTo(0.5, 9);
    expect(result.goodN).toBe(4);
    expect(result.badN).toBe(4);
  });

  it("empty input -> null value", () => {
    const result = selfServingIndex([]);
    expect(result.value).toBeNull();
    expect(result.goodN).toBe(0);
    expect(result.badN).toBe(0);
  });

  it("missing one side -> null value, counts still returned", () => {
    const result = selfServingIndex([{ attribution: "skill", good: true }]);
    expect(result.value).toBeNull();
    expect(result.goodN).toBe(1);
    expect(result.badN).toBe(0);
  });
});
