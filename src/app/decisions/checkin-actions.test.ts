import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const checkinSingle = vi.fn();
const forecastSingle = vi.fn();
const forecastsListOrder = vi.fn();
const checkinUpdateEq = vi.fn();
const forecastUpdateEq = vi.fn();
const revealRefetchSingle = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "checkins") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: checkinSingle })) })),
          update: vi.fn(() => ({ eq: checkinUpdateEq })),
        };
      }
      // forecasts: distinguish a single-row lookup (by id) from the list query
      // (decision_id + resolved filter, ordered) by call shape below
      return {
        select: vi.fn((cols: string) => {
          if (cols === "probability") {
            return { eq: vi.fn(() => ({ single: revealRefetchSingle })) };
          }
          return {
            eq: vi.fn((col: string) => {
              if (col === "id") return { single: forecastSingle };
              // decision_id filter -> chain into a second .eq(resolved) -> .order()
              return { eq: vi.fn(() => ({ order: forecastsListOrder })) };
            }),
          };
        }),
        update: vi.fn(() => ({ eq: forecastUpdateEq })),
      };
    }),
  })),
}));

describe("checkin-actions", () => {
  beforeEach(() => {
    getUser.mockReset();
    checkinSingle.mockReset();
    forecastSingle.mockReset();
    forecastsListOrder.mockReset();
    checkinUpdateEq.mockReset();
    forecastUpdateEq.mockReset();
    revealRefetchSingle.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  describe("getRecallForecasts", () => {
    it("excludes the recorded probability for a forecast not yet revealed", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastsListOrder.mockResolvedValue({
        data: [
          {
            id: "f1",
            question: "q?",
            desired: true,
            resolved: false,
            outcome: null,
            probability: 0.73,
            recalled_probability: null,
            revealed_at: null,
          },
        ],
        error: null,
      });

      const { getRecallForecasts } = await import("./checkin-actions");
      const result = await getRecallForecasts("c1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.forecasts).toHaveLength(1);
        expect(result.forecasts[0].probability).toBeNull();
        expect(JSON.stringify(result.forecasts)).not.toContain("0.73");
      }
    });

    it("includes the recorded probability once revealed", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastsListOrder.mockResolvedValue({
        data: [
          {
            id: "f1",
            question: "q?",
            desired: true,
            resolved: false,
            outcome: null,
            probability: 0.73,
            recalled_probability: 0.5,
            revealed_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      });

      const { getRecallForecasts } = await import("./checkin-actions");
      const result = await getRecallForecasts("c1");

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.forecasts[0].probability).toBe(0.73);
    });

    it("treats another user's check-in as not found", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "other", decision_id: "d1", status: "due" }, error: null });
      const { getRecallForecasts } = await import("./checkin-actions");
      const result = await getRecallForecasts("c1");
      expect(result).toEqual({ ok: false, errors: ["Check-in not found."] });
    });
  });

  describe("recordRecall", () => {
    it("rejects an out-of-range probability", async () => {
      const { recordRecall } = await import("./checkin-actions");
      const result = await recordRecall("f1", 1.5);
      expect(result.ok).toBe(false);
    });

    it("rejects once revealed_at is already set", async () => {
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: "2026-01-01T00:00:00Z" },
        error: null,
      });
      const { recordRecall } = await import("./checkin-actions");
      const result = await recordRecall("f1", 0.5);
      expect(result).toEqual({ ok: false, errors: ["Recall was already captured for this forecast."] });
    });

    it("records the recall while revealed_at is null", async () => {
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: null },
        error: null,
      });
      forecastUpdateEq.mockResolvedValue({ error: null });
      const { recordRecall } = await import("./checkin-actions");
      const result = await recordRecall("f1", 0.5);
      expect(result).toEqual({ ok: true });
    });
  });

  describe("revealForecast", () => {
    it("sets revealed_at and returns the recorded probability", async () => {
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: null },
        error: null,
      });
      forecastUpdateEq.mockResolvedValue({ error: null });
      revealRefetchSingle.mockResolvedValue({ data: { probability: 0.73 }, error: null });

      const { revealForecast } = await import("./checkin-actions");
      const result = await revealForecast("f1");
      expect(result).toEqual({ ok: true, probability: 0.73 });
    });
  });

  describe("resolveForecast", () => {
    it("no-ops on can't-resolve-yet", async () => {
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "unresolved");
      expect(result).toEqual({ ok: true });
    });

    it("rejects a cross-decision forecast/check-in pair", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d2", resolved: false, revealed_at: "2026-01-01T00:00:00Z" },
        error: null,
      });
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "yes");
      expect(result).toEqual({ ok: false, errors: ["Forecast does not belong to this decision."] });
    });

    it("rejects resolving before the recorded value has been revealed", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: null },
        error: null,
      });
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "yes");
      expect(result).toEqual({ ok: false, errors: ["Reveal the recorded probability before resolving."] });
    });

    it("resolves a revealed forecast and links resolved_in_checkin_id to this check-in", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: "2026-01-01T00:00:00Z" },
        error: null,
      });
      forecastUpdateEq.mockResolvedValue({ error: null });

      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "no");
      expect(result).toEqual({ ok: true });
    });
  });
});
