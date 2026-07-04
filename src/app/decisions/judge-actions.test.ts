import { beforeEach, describe, expect, it, vi } from "vitest";

const decisionFetchSingle = vi.fn();
// forecasts/risks now chain two .order() calls (created_at, then id tiebreak) —
// the tiebreak is what makes input_hash reproducible on reassembly, see REVIEW.md
const forecastsSelect = vi.fn();
const latestPremortemMaybeSingle = vi.fn();
const risksSelect = vi.fn();
const judgeScoresInsert = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "decisions") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: decisionFetchSingle })) })) };
      }
      if (table === "forecasts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn(() => ({ order: forecastsSelect })) })),
          })),
        };
      }
      if (table === "premortems") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: latestPremortemMaybeSingle })) })) })),
          })),
        };
      }
      if (table === "judge_scores") {
        return { insert: judgeScoresInsert };
      }
      // premortem_risks
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ order: risksSelect })) })) })) };
    }),
  })),
}));

const hasAnthropicKey = vi.fn(() => true);
vi.mock("@/lib/llm/client", () => ({ hasAnthropicKey }));

const generateJudgeScores = vi.fn();
vi.mock("@/lib/llm/judge", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm/judge")>("@/lib/llm/judge");
  return { ...actual, generateJudgeScores };
});

vi.mock("@/lib/prompts/template", () => ({
  loadPromptTemplate: vi.fn(async () => ({ model: "claude-sonnet-5", system: "sys {{title}}", user: "user {{title}}" })),
  renderTemplate: vi.fn((template: string, ctx: Record<string, unknown>) =>
    template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in ctx ? String(ctx[key]) : match)),
  ),
}));

const startTrace = vi.fn(() => ({ traceId: "trace-1", end: vi.fn() }));
vi.mock("@/lib/llm/tracing", () => ({ startTrace }));

function activeDecision(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: "u1",
    title: "Take the job",
    context: "ctx",
    rationale: "because",
    options_considered: ["a", "b"],
    chosen_option: "a",
    stakes: "medium",
    reversibility: "two_way",
    ...overrides,
  };
}

function validScores(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true,
    scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 },
    rationale: {
      risk_comprehensiveness: "a",
      calibration_given_knowable: "b",
      process_quality: "c",
    },
    evidenceSpans: ["quote"],
    contamination: false,
    ...overrides,
  };
}

describe("assembleJudgeInput", () => {
  it("only ever contains the outcome-free fields per DATA_MODEL rule 3", async () => {
    const { assembleJudgeInput } = await import("./judge-actions");
    const input = assembleJudgeInput({
      decision: activeDecision(),
      forecasts: [{ question: "q", probability: 0.6, desired: true }],
      risks: [{ description: "d", category: "execution", severity: "medium", source: "ai" }],
    });

    const serialized = JSON.stringify(input);
    for (const outcomeField of ["outcome", "resolved", "resolved_at", "recalled_probability", "revealed_at", "attribution"]) {
      expect(serialized).not.toContain(outcomeField);
    }
  });

  it("reproduces the same hash on reassembly of the same payload", async () => {
    const { assembleJudgeInput } = await import("./judge-actions");
    const { hashJudgeInput } = await import("@/lib/llm/judge");

    const params = {
      decision: activeDecision(),
      forecasts: [{ question: "q", probability: 0.6, desired: true }],
      risks: [{ description: "d", category: "execution", severity: "medium", source: "ai" }],
    };
    const first = assembleJudgeInput(params);
    const second = assembleJudgeInput(params);
    expect(hashJudgeInput(first)).toBe(hashJudgeInput(second));
  });
});

describe("runJudge", () => {
  beforeEach(() => {
    decisionFetchSingle.mockReset();
    forecastsSelect.mockReset();
    latestPremortemMaybeSingle.mockReset();
    risksSelect.mockReset();
    judgeScoresInsert.mockReset();
    generateJudgeScores.mockReset();
    hasAnthropicKey.mockReturnValue(true);

    decisionFetchSingle.mockResolvedValue({ data: activeDecision(), error: null });
    forecastsSelect.mockResolvedValue({ data: [] });
    latestPremortemMaybeSingle.mockResolvedValue({ data: null });
    judgeScoresInsert.mockResolvedValue({ error: null });
  });

  it("does nothing when ANTHROPIC_API_KEY is not configured", async () => {
    hasAnthropicKey.mockReturnValue(false);
    const { runJudge } = await import("./judge-actions");
    await runJudge("d1");
    expect(decisionFetchSingle).not.toHaveBeenCalled();
  });

  it("persists judge_scores on a clean scoring pass", async () => {
    risksSelect.mockResolvedValue({ data: [] });
    generateJudgeScores.mockResolvedValue(validScores());

    const { runJudge } = await import("./judge-actions");
    await runJudge("d1");

    expect(judgeScoresInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        decision_id: "d1",
        user_id: "u1",
        prompt_version: "judge_v1",
        scores: { risk_comprehensiveness: 3, calibration_given_knowable: 4, process_quality: 2 },
        contamination: false,
      }),
    );
    // JUDGE_RUBRIC §Protocol: the trace must carry rubric_version alongside prompt_version
    expect(startTrace).toHaveBeenCalledWith(expect.objectContaining({ rubricVersion: "v1" }));
  });

  it("logs a warning and still persists when the judge flags contamination", async () => {
    risksSelect.mockResolvedValue({ data: [] });
    generateJudgeScores.mockResolvedValue(validScores({ contamination: true }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { runJudge } = await import("./judge-actions");
    await runJudge("d1");

    expect(warnSpy).toHaveBeenCalled();
    expect(judgeScoresInsert).toHaveBeenCalledWith(expect.objectContaining({ contamination: true }));
    warnSpy.mockRestore();
  });

  it("logs and returns without persisting when the judge call fails", async () => {
    risksSelect.mockResolvedValue({ data: [] });
    generateJudgeScores.mockResolvedValue({ ok: false, error: "Model response was not valid JSON." });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { runJudge } = await import("./judge-actions");
    await runJudge("d1");

    expect(judgeScoresInsert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("stores an input_hash reproducible from the assembled payload", async () => {
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm1" } });
    risksSelect.mockResolvedValue({
      data: [{ description: "d", category: "execution", severity: "medium", source: "ai" }],
    });
    generateJudgeScores.mockResolvedValue(validScores());

    const { runJudge, assembleJudgeInput } = await import("./judge-actions");
    const { hashJudgeInput } = await import("@/lib/llm/judge");
    await runJudge("d1");

    const expectedInput = assembleJudgeInput({
      decision: activeDecision(),
      forecasts: [],
      risks: [{ description: "d", category: "execution", severity: "medium", source: "ai" }],
    });
    const insertedArgs = judgeScoresInsert.mock.calls[0][0];
    expect(insertedArgs.input_hash).toBe(hashJudgeInput(expectedInput));
  });

  it("hashes risks in the order the (ordered) query returns them", async () => {
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm1" } });
    const orderedRisks = [
      { description: "r1", category: "execution", severity: "medium", source: "ai" },
      { description: "r2", category: "market", severity: "high", source: "ai" },
    ];
    risksSelect.mockResolvedValue({ data: orderedRisks });
    generateJudgeScores.mockResolvedValue(validScores());

    const { runJudge, assembleJudgeInput } = await import("./judge-actions");
    const { hashJudgeInput } = await import("@/lib/llm/judge");
    await runJudge("d1");

    const expectedInput = assembleJudgeInput({ decision: activeDecision(), forecasts: [], risks: orderedRisks });
    const insertedArgs = judgeScoresInsert.mock.calls[0][0];
    expect(insertedArgs.input_hash).toBe(hashJudgeInput(expectedInput));
  });
});
