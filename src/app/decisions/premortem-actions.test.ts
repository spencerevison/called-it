import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const decisionFetchSingle = vi.fn();
const forecastsSelect = vi.fn();
const premortemInsertSingle = vi.fn();
const risksInsert = vi.fn();
const premortemDeleteEq = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "decisions") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: decisionFetchSingle })) })) };
      }
      if (table === "forecasts") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: forecastsSelect })) })) };
      }
      if (table === "premortems") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: premortemInsertSingle })) })),
          delete: vi.fn(() => ({ eq: premortemDeleteEq })),
        };
      }
      return { insert: risksInsert };
    }),
  })),
}));

const hasAnthropicKey = vi.fn(() => true);
vi.mock("@/lib/llm/client", () => ({ hasAnthropicKey }));

const generatePremortemRisks = vi.fn();
vi.mock("@/lib/llm/premortem", () => ({ generatePremortemRisks }));

vi.mock("@/lib/prompts/template", () => ({
  loadPromptTemplate: vi.fn(async () => ({ model: "claude-sonnet-5", system: "sys", user: "user {{title}}" })),
  renderTemplate: vi.fn((template: string) => template),
}));

const startTrace = vi.fn(() => ({ traceId: "trace-1", end: vi.fn() }));
vi.mock("@/lib/llm/tracing", () => ({ startTrace }));

function draftDecision(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: "u1",
    status: "draft",
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

describe("generatePremortem", () => {
  beforeEach(() => {
    getUser.mockReset();
    decisionFetchSingle.mockReset();
    forecastsSelect.mockReset();
    premortemInsertSingle.mockReset();
    risksInsert.mockReset();
    premortemDeleteEq.mockReset();
    generatePremortemRisks.mockReset();
    hasAnthropicKey.mockReturnValue(true);

    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    forecastsSelect.mockResolvedValue({ data: [] });
    risksInsert.mockResolvedValue({ error: null });
    premortemDeleteEq.mockResolvedValue({ error: null });
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
  });

  it("rejects a decision that isn't owned by the caller", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision({ user_id: "other" }), error: null });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({ ok: false, errors: ["Decision not found."] });
  });

  it("rejects a non-draft decision", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision({ status: "active" }), error: null });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({
      ok: false,
      errors: ["Pre-mortems can only be generated while the decision is a draft."],
    });
  });

  it("rejects a decision with fewer than 2 options", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision({ options_considered: ["only one"] }), error: null });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({
      ok: false,
      errors: ["At least 2 options are required to generate a pre-mortem."],
    });
  });

  it("refuses to call the live model when ANTHROPIC_API_KEY is not configured", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    hasAnthropicKey.mockReturnValue(false);
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({ ok: false, errors: ["ANTHROPIC_API_KEY is not configured."] });
    expect(generatePremortemRisks).not.toHaveBeenCalled();
  });

  it("surfaces a malformed-JSON-after-retry error without persisting anything", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    generatePremortemRisks.mockResolvedValue({ ok: false, error: "Model response was not valid JSON." });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");
    expect(result).toEqual({ ok: false, errors: ["Model response was not valid JSON."] });
    expect(premortemInsertSingle).not.toHaveBeenCalled();
  });

  it("deletes the orphaned premortem row when the risks insert fails", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    const risks = Array.from({ length: 6 }, (_, i) => ({
      description: `risk ${i}`,
      category: "execution",
      severity: "medium",
      likelihood: 0.3,
    }));
    generatePremortemRisks.mockResolvedValue({ ok: true, risks });
    premortemInsertSingle.mockResolvedValue({ data: { id: "pm1" }, error: null });
    risksInsert.mockResolvedValue({ error: { message: "insert failed" } });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");

    expect(result).toEqual({ ok: false, errors: ["insert failed"] });
    expect(premortemDeleteEq).toHaveBeenCalledWith("id", "pm1");
  });

  it("persists the premortem and risks on success", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    const risks = Array.from({ length: 6 }, (_, i) => ({
      description: `risk ${i}`,
      category: "execution",
      severity: "medium",
      likelihood: 0.3,
    }));
    generatePremortemRisks.mockResolvedValue({ ok: true, risks });
    premortemInsertSingle.mockResolvedValue({ data: { id: "pm1" }, error: null });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");

    expect(result).toEqual({ ok: true, id: "pm1" });
    expect(risksInsert).toHaveBeenCalledWith(
      risks.map((r) => ({
        user_id: "u1",
        premortem_id: "pm1",
        description: r.description,
        category: r.category,
        severity: r.severity,
        likelihood: r.likelihood,
        source: "ai",
      })),
    );
  });
});
