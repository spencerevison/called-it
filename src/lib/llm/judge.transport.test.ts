import { describe, expect, it, vi } from "vitest";

// plain (non-spy) throwing mock: vitest v4 surfaces errors thrown through a vi.fn
// spy even when the code under test catches them, which would fail this assertion.
vi.mock("./client", () => ({
  generateText: () => {
    throw new Error("529 overloaded");
  },
}));

import { generateJudgeScores } from "./judge";

describe("generateJudgeScores — transport failure", () => {
  it("maps a thrown SDK error to ok:false instead of rejecting", async () => {
    const result = await generateJudgeScores({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Model call failed");
  });
});
