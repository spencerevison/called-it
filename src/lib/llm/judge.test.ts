import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("./client", () => ({ generateText }));

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 },
    rationale: {
      risk_comprehensiveness: "covers the obvious categories",
      calibration_given_knowable: "tracks stated evidence",
      process_quality: "only one option considered",
    },
    evidence_spans: ["quoted span"],
    contamination: false,
    ...overrides,
  });
}

describe("parseJudgeResponse", () => {
  it("accepts a well-formed response", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const result = parseJudgeResponse(validPayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scores).toEqual({ risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 });
      expect(result.contamination).toBe(false);
    }
  });

  it("rejects malformed JSON", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const result = parseJudgeResponse("not json");
    expect(result).toEqual({ ok: false, error: "Model response was not valid JSON." });
  });

  it("rejects a non-integer score", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const payload = JSON.stringify({
      scores: { risk_comprehensiveness: 3.5, calibration_given_knowable: 4, process_quality: 2 },
      rationale: { risk_comprehensiveness: "a", calibration_given_knowable: "b", process_quality: "c" },
      evidence_spans: [],
      contamination: false,
    });
    const result = parseJudgeResponse(payload);
    expect(result.ok).toBe(false);
  });

  it("rejects a score out of 1-5 range", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const payload = JSON.stringify({
      scores: { risk_comprehensiveness: 6, calibration_given_knowable: 4, process_quality: 2 },
      rationale: { risk_comprehensiveness: "a", calibration_given_knowable: "b", process_quality: "c" },
      evidence_spans: [],
      contamination: false,
    });
    const result = parseJudgeResponse(payload);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing rationale dimension", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const payload = JSON.stringify({
      scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 },
      rationale: { risk_comprehensiveness: "a", calibration_given_knowable: "b" },
      evidence_spans: [],
      contamination: false,
    });
    const result = parseJudgeResponse(payload);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-boolean contamination field", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const result = parseJudgeResponse(validPayload({ contamination: "false" }));
    expect(result.ok).toBe(false);
  });

  it("accepts contamination: true (still parses, caller decides what to do)", async () => {
    const { parseJudgeResponse } = await import("./judge");
    const result = parseJudgeResponse(validPayload({ contamination: true }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contamination).toBe(true);
  });
});

describe("hashJudgeInput", () => {
  it("is deterministic for the same input", async () => {
    const { hashJudgeInput } = await import("./judge");
    const input = {
      title: "Take the job",
      context: "ctx",
      rationale: "because",
      options_considered: ["a", "b"],
      chosen_option: "a",
      stakes: "medium",
      reversibility: "two_way",
      forecasts: [{ question: "q", probability: 0.6, desired: true }],
      risks: [{ description: "d", category: "execution", severity: "medium", source: "ai" }],
    };
    expect(hashJudgeInput(input)).toBe(hashJudgeInput(JSON.parse(JSON.stringify(input))));
  });

  it("changes when any field changes", async () => {
    const { hashJudgeInput } = await import("./judge");
    const base = {
      title: "Take the job",
      context: "ctx",
      rationale: "because",
      options_considered: ["a", "b"],
      chosen_option: "a",
      stakes: "medium",
      reversibility: "two_way",
      forecasts: [],
      risks: [],
    };
    expect(hashJudgeInput(base)).not.toBe(hashJudgeInput({ ...base, title: "Take the other job" }));
  });
});

describe("generateJudgeScores", () => {
  beforeEach(() => generateText.mockReset());

  it("returns parsed scores on a clean first response", async () => {
    generateText.mockResolvedValueOnce(validPayload());
    const { generateJudgeScores } = await import("./judge");
    const result = await generateJudgeScores({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("retries once after a malformed first response, then succeeds", async () => {
    generateText.mockResolvedValueOnce("not json").mockResolvedValueOnce(validPayload());
    const { generateJudgeScores } = await import("./judge");
    const result = await generateJudgeScores({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("errors after a second malformed response", async () => {
    generateText.mockResolvedValueOnce("not json").mockResolvedValueOnce("still not json");
    const { generateJudgeScores } = await import("./judge");
    const result = await generateJudgeScores({ model: "claude-sonnet-5", system: "s", user: "u" });
    expect(result.ok).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  // the transport-throw path (generateText rejects → ok:false) lives in
  // judge.transport.test.ts: vitest v4 surfaces errors thrown through a vi.fn
  // spy even when caught, so that case uses a plain (non-spy) throwing mock.
});
