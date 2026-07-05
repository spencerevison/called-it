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
const latestPremortemMaybeSingle = vi.fn();
const userRisksSelect = vi.fn();
const premortemsEq = vi.fn();
const premortemsIs = vi.fn();

// premortems select supports chained .eq()/.is() (decision_id + option scoping) before
// terminating in either .single() (ownership fetch) or .order().limit().maybeSingle()
// (latest-premortem-for-this-option lookup) - see T56.
function premortemsSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((...args: unknown[]) => {
    premortemsEq(...args);
    return chain;
  });
  chain.is = vi.fn((...args: unknown[]) => {
    premortemsIs(...args);
    return chain;
  });
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = premortemFetchSingle;
  chain.maybeSingle = latestPremortemMaybeSingle;
  return chain;
}

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
          select: vi.fn(() => premortemsSelectChain()),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: premortemInsertSingle })) })),
          delete: vi.fn(() => ({ eq: premortemDeleteEq })),
        };
      }
      // premortem_risks
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: userRisksSelect })) })),
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
    latestPremortemMaybeSingle.mockReset();
    userRisksSelect.mockReset();
    premortemsEq.mockReset();
    premortemsIs.mockReset();
    hasAnthropicKey.mockReturnValue(true);

    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    forecastsSelect.mockResolvedValue({ data: [] });
    risksInsert.mockResolvedValue({ error: null });
    premortemDeleteEq.mockResolvedValue({ error: null });
    // no previous premortem by default -> nothing to carry forward
    latestPremortemMaybeSingle.mockResolvedValue({ data: null });
    userRisksSelect.mockResolvedValue({ data: [] });
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

  it("carries the user's own risks forward onto the new premortem on regenerate", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    const aiRisks = [{ description: "ai risk", category: "execution", severity: "medium", likelihood: 0.3 }];
    generatePremortemRisks.mockResolvedValue({ ok: true, risks: aiRisks });
    premortemInsertSingle.mockResolvedValue({ data: { id: "pm2" }, error: null });
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm1" } });
    userRisksSelect.mockResolvedValue({
      data: [{ description: "my own risk", category: "external", severity: "high", user_id: "u1" }],
    });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1");

    expect(result).toEqual({ ok: true, id: "pm2" });
    expect(risksInsert).toHaveBeenNthCalledWith(2, [
      { user_id: "u1", premortem_id: "pm2", description: "my own risk", category: "external", severity: "high", source: "user" },
    ]);
    // no option given -> legacy whole-decision lookup, matched via .is(), not .eq("option", ...)
    expect(premortemsIs).toHaveBeenCalledWith("option", null);
  });

  it("rejects an option that isn't one of the decision's options_considered", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1", "not-a-real-option");
    expect(result).toEqual({ ok: false, errors: ["Option must be one of the options considered."] });
    expect(generatePremortemRisks).not.toHaveBeenCalled();
  });

  it("renders the prompt with chosen_option overridden to the given option", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision({ chosen_option: "a" }), error: null });
    generatePremortemRisks.mockResolvedValue({
      ok: true,
      risks: [{ description: "r", category: "execution", severity: "medium", likelihood: 0.3 }],
    });
    premortemInsertSingle.mockResolvedValue({ data: { id: "pm1" }, error: null });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1", "b");

    expect(result).toEqual({ ok: true, id: "pm1" });
    // scoped lookup for the previous premortem uses this option, not the legacy null slot
    expect(premortemsEq).toHaveBeenCalledWith("option", "b");
  });

  it("scopes carry-forward and the previous-premortem lookup to the same option only, on regenerate", async () => {
    decisionFetchSingle.mockResolvedValue({ data: draftDecision(), error: null });
    generatePremortemRisks.mockResolvedValue({
      ok: true,
      risks: [{ description: "r", category: "execution", severity: "medium", likelihood: 0.3 }],
    });
    premortemInsertSingle.mockResolvedValue({ data: { id: "pm-a-2" }, error: null });
    // only option A has a previous premortem to carry forward from
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm-a-1" } });
    userRisksSelect.mockResolvedValue({
      data: [{ description: "option a user risk", category: "external", severity: "high", user_id: "u1" }],
    });

    const { generatePremortem } = await import("./premortem-actions");
    const result = await generatePremortem("d1", "a");

    expect(result).toEqual({ ok: true, id: "pm-a-2" });
    expect(premortemsEq).toHaveBeenCalledWith("option", "a");
    expect(premortemsEq).not.toHaveBeenCalledWith("option", "b");
    expect(risksInsert).toHaveBeenNthCalledWith(2, [
      {
        user_id: "u1",
        premortem_id: "pm-a-2",
        description: "option a user risk",
        category: "external",
        severity: "high",
        source: "user",
      },
    ]);
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
    latestPremortemMaybeSingle.mockReset();
    premortemsEq.mockReset();
    premortemsIs.mockReset();

    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // default: the premortem being written to is the latest one for its decision
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm1" } });
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
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1", option: null }, error: null });
    decisionFetchSingle.mockResolvedValue({ data: { status: "active" }, error: null });
    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());
    expect(result).toEqual({ ok: false, errors: ["Risks can only be added while the decision is a draft."] });
    expect(risksInsert).not.toHaveBeenCalled();
  });

  it("rejects an add-risk against a premortem that's been superseded by a regenerate", async () => {
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1", option: null }, error: null });
    decisionFetchSingle.mockResolvedValue({ data: { status: "draft" }, error: null });
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm2" } });

    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());

    expect(result).toEqual({ ok: false, errors: ["This pre-mortem has been regenerated — reload the page."] });
    expect(risksInsert).not.toHaveBeenCalled();
  });

  it("scopes the superseded-check to the premortem's own option, not just its decision", async () => {
    // option A's premortem is still the latest for option A even though option B has a newer one
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1", option: "a" }, error: null });
    decisionFetchSingle.mockResolvedValue({ data: { status: "draft" }, error: null });
    latestPremortemMaybeSingle.mockResolvedValue({ data: { id: "pm1" } });
    userRiskInsertSingle.mockResolvedValue({ data: { id: "risk1" }, error: null });

    const { addUserRisk } = await import("./premortem-actions");
    const result = await addUserRisk("pm1", riskFormData());

    expect(result).toEqual({ ok: true, id: "risk1" });
    expect(premortemsEq).toHaveBeenCalledWith("option", "a");
  });

  it("persists a user risk on a draft decision", async () => {
    premortemFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1", option: null }, error: null });
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
