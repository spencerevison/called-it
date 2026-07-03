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
const premortemFetchSingle = vi.fn();
const userRiskInsertSingle = vi.fn();

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
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: premortemFetchSingle })) })),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: premortemInsertSingle })) })),
          delete: vi.fn(() => ({ eq: premortemDeleteEq })),
        };
      }
      return {
        insert: vi.fn((arg) => {
          if (Array.isArray(arg)) return risksInsert(arg);
          risksInsert(arg);
          return { select: vi.fn(() => ({ single: userRiskInsertSingle })) };
        }),
      };
    }),
  })),
}));

const hasAnthropicKey = vi.fn(() => true);
vi.mock("@/lib/llm/client", () => ({ hasAnthropicKey }));

const generatePremortemRisks = vi.fn();
vi.mock("@/lib/llm/premortem", () => ({
  generatePremortemRisks,
  RISK_CATEGORIES: ["execution", "external", "information", "motivated_reasoning", "second_order"],
  RISK_SEVERITIES: ["low", "medium", "high"],
}));

vi.mock("@/lib/prompts/template", () => ({
  loadPromptTemplate: vi.fn(async () => ({
    model: "claude-sonnet-5",
    system: "sys {{horizon_months}}",
    user: "user {{title}}",
  })),
  renderTemplate: vi.fn((template: string, ctx: Record<string, unknown>) =>
    template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in ctx ? String(ctx[key]) : match)),
  ),
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

  it("aborts if the decision left draft while the model was generating", async () => {
    // first fetch: still a draft (passes the gate), second fetch after the LLM
    // call: already committed -> must refuse without inserting anything
    decisionFetchSingle
      .mockResolvedValueOnce({ data: draftDecision(), error: null })
      .mockResolvedValueOnce({ data: { user_id: "u1", status: "active" }, error: null });
    generatePremortemRisks.mockResolvedValue({
      ok: true,
      risks: [{ description: "r", category: "execution", severity: "medium", likelihood: 0.3 }],
    });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");

    expect(result).toEqual({
      ok: false,
      errors: ["Pre-mortems can only be generated while the decision is a draft."],
    });
    expect(premortemInsertSingle).not.toHaveBeenCalled();
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
    const callArgs = generatePremortemRisks.mock.calls[0][0];
    expect(callArgs.system).toContain("6");
    expect(callArgs.system).not.toContain("{{");
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

function riskFormData(overrides: Partial<Record<string, string>> = {}) {
  const data = new FormData();
  const fields = { description: "Vendor could go dark mid-project", category: "external", severity: "high", ...overrides };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("addUserRisk", () => {
  beforeEach(() => {
    getUser.mockReset();
    premortemFetchSingle.mockReset();
    decisionFetchSingle.mockReset();
    risksInsert.mockReset();
    userRiskInsertSingle.mockReset();

    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());
    expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
  });

  it("rejects invalid fields before touching the database", async () => {
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData({ description: "", category: "bogus", severity: "bogus" }));
    expect(result.ok).toBe(false);
    expect(premortemFetchSingle).not.toHaveBeenCalled();
  });

  it("rejects a premortem not owned by the caller (IDOR)", async () => {
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "other", decision_id: "d1" }, error: null });
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());
    expect(result).toEqual({ ok: false, errors: ["Pre-mortem not found."] });
    expect(decisionFetchSingle).not.toHaveBeenCalled();
    expect(risksInsert).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent premortem", async () => {
    premortemFetchSingle.mockResolvedValue({ data: null, error: { message: "no rows" } });
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());
    expect(result).toEqual({ ok: false, errors: ["Pre-mortem not found."] });
  });

  it("rejects once the parent decision is no longer a draft", async () => {
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1" }, error: null });
    decisionFetchSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());
    expect(result).toEqual({ ok: false, errors: ["Risks can only be added while the decision is a draft."] });
    expect(risksInsert).not.toHaveBeenCalled();
  });

  it("persists a user risk on a draft decision", async () => {
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1" }, error: null });
    decisionFetchSingle.mockResolvedValue({ data: { status: "draft" }, error: null });
    userRiskInsertSingle.mockResolvedValue({ data: { id: "risk1" }, error: null });

    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());

    expect(result).toEqual({ ok: true, id: "risk1" });
    expect(risksInsert).toHaveBeenCalledWith({
      user_id: "u1",
      premortem_id: "pm1",
      description: "Vendor could go dark mid-project",
      category: "external",
      severity: "high",
      source: "user",
    });
  });
});
