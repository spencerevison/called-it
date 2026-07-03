import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const decisionFetchSingle = vi.fn();
const forecastFetchSingle = vi.fn();
const insertSingle = vi.fn();
const updateEq = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "decisions") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: decisionFetchSingle })) })) };
      }
      return {
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: insertSingle })) })),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: forecastFetchSingle })) })),
        update: vi.fn(() => ({ eq: updateEq })),
      };
    }),
  })),
}));

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createForecast / updateForecast", () => {
  beforeEach(() => {
    getUser.mockReset();
    decisionFetchSingle.mockReset();
    forecastFetchSingle.mockReset();
    insertSingle.mockReset();
    updateEq.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  describe("createForecast", () => {
    it("rejects a missing question", async () => {
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "", probability: "0.5" }));
      expect(result).toEqual({ ok: false, errors: ["Question is required."] });
    });

    it("rejects an out-of-range probability", async () => {
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "q?", probability: "1.5" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContain("Probability must be between 0.01 and 0.99.");
    });

    it("requires an authenticated user", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "q?", probability: "0.5" }));
      expect(result).toEqual({ ok: false, errors: ["Not signed in."] });
    });

    it("blocks adding to another user's decision", async () => {
      decisionFetchSingle.mockResolvedValue({ data: { user_id: "other", status: "draft" }, error: null });
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "q?", probability: "0.5" }));
      expect(result).toEqual({ ok: false, errors: ["Decision not found."] });
    });

    it("blocks adding once the decision is no longer a draft", async () => {
      decisionFetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "active" }, error: null });
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "q?", probability: "0.5" }));
      expect(result).toEqual({
        ok: false,
        errors: ["Forecasts can only be added or edited while the decision is a draft."],
      });
    });

    it("persists a valid forecast, defaulting desired to false when the checkbox is absent", async () => {
      decisionFetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "draft" }, error: null });
      insertSingle.mockResolvedValue({ data: { id: "f1" }, error: null });
      const { createForecast } = await import("./forecast-actions");
      const result = await createForecast("d1", buildFormData({ question: "q?", probability: "0.42" }));
      expect(result).toEqual({ ok: true, id: "f1" });
    });
  });

  describe("updateForecast", () => {
    it("treats another user's forecast as not found", async () => {
      forecastFetchSingle.mockResolvedValue({ data: { user_id: "other", decision_id: "d1" }, error: null });
      const { updateForecast } = await import("./forecast-actions");
      const result = await updateForecast("f1", buildFormData({ question: "q?", probability: "0.5" }));
      expect(result).toEqual({ ok: false, errors: ["Forecast not found."] });
    });

    it("blocks edits once the parent decision is no longer a draft", async () => {
      forecastFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1" }, error: null });
      decisionFetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "active" }, error: null });
      const { updateForecast } = await import("./forecast-actions");
      const result = await updateForecast("f1", buildFormData({ question: "q?", probability: "0.5" }));
      expect(result).toEqual({
        ok: false,
        errors: ["Forecasts can only be added or edited while the decision is a draft."],
      });
    });

    it("updates an owned forecast on a draft decision", async () => {
      forecastFetchSingle.mockResolvedValue({ data: { user_id: "u1", decision_id: "d1" }, error: null });
      decisionFetchSingle.mockResolvedValue({ data: { user_id: "u1", status: "draft" }, error: null });
      updateEq.mockResolvedValue({ error: null });
      const { updateForecast } = await import("./forecast-actions");
      const result = await updateForecast(
        "f1",
        buildFormData({ question: "q?", probability: "0.5", desired: "on" }),
      );
      expect(result).toEqual({ ok: true, id: "f1" });
    });
  });
});
