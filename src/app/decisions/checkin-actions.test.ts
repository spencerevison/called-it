import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const checkinSingle = vi.fn();
const forecastSingle = vi.fn();
const forecastsListOrder = vi.fn();
const checkinUpdateEq = vi.fn(); // submitOutcomeNotes: .update().eq("id") awaited directly -> {error}
const checkinUpdateInSelect = vi.fn(); // completeCheckin: .update().eq("id").in("status",[...]).select("id") -> {data, error}
// conditional-update chain: .update().eq("id", ...).is/.eq(guard).select("id") -> resolves to {data, error}
const forecastUpdateSelect = vi.fn();
const revealRefetchSingle = vi.fn();
const riskSingle = vi.fn();
const premortemSingle = vi.fn();
const checkinFailuresInsert = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "checkins") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: checkinSingle })) })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({ select: checkinUpdateInSelect })),
              then: (resolve: (v: unknown) => void) => resolve(checkinUpdateEq()),
            })),
          })),
        };
      }
      if (table === "premortem_risks") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: riskSingle })) })) };
      }
      if (table === "premortems") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: premortemSingle })) })) };
      }
      if (table === "checkin_failures") {
        return { insert: checkinFailuresInsert };
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
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({ select: forecastUpdateSelect })),
            eq: vi.fn(() => ({ select: forecastUpdateSelect })),
          })),
        })),
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
    checkinUpdateInSelect.mockReset();
    forecastUpdateSelect.mockReset();
    revealRefetchSingle.mockReset();
    riskSingle.mockReset();
    premortemSingle.mockReset();
    checkinFailuresInsert.mockReset();
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
      forecastUpdateSelect.mockResolvedValue({ data: [{ id: "f1" }], error: null });
      const { recordRecall } = await import("./checkin-actions");
      const result = await recordRecall("f1", 0.5);
      expect(result).toEqual({ ok: true });
    });

    it("rejects when a concurrent reveal wins the race (conditional update matches zero rows)", async () => {
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: null },
        error: null,
      });
      // read saw revealed_at: null, but the guarded write itself matched nothing --
      // another request revealed it first
      forecastUpdateSelect.mockResolvedValue({ data: [], error: null });
      const { recordRecall } = await import("./checkin-actions");
      const result = await recordRecall("f1", 0.5);
      expect(result).toEqual({ ok: false, errors: ["Recall was already captured for this forecast."] });
    });
  });

  describe("revealForecast", () => {
    it("sets revealed_at and returns the recorded probability", async () => {
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: false, revealed_at: null },
        error: null,
      });
      forecastUpdateSelect.mockResolvedValue({ data: [{ id: "f1" }], error: null });
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
      forecastUpdateSelect.mockResolvedValue({ data: [{ id: "f1" }], error: null });

      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "no");
      expect(result).toEqual({ ok: true });
    });

    it("rejects re-resolving an already-resolved forecast", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c2", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      forecastSingle.mockResolvedValue({
        data: { id: "f1", user_id: "u1", decision_id: "d1", resolved: true, revealed_at: "2026-01-01T00:00:00Z" },
        error: null,
      });
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c2", "f1", "no");
      expect(result).toEqual({ ok: false, errors: ["This forecast has already been resolved."] });
    });

    it("rejects resolving into a completed check-in (would corrupt M9 valence)", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "completed" }, error: null });
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "yes");
      expect(result).toEqual({ ok: false, errors: ["This check-in is completed and can no longer resolve forecasts."] });
    });

    it("rejects resolving into a skipped check-in", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "skipped" }, error: null });
      const { resolveForecast } = await import("./checkin-actions");
      const result = await resolveForecast("c1", "f1", "yes");
      expect(result).toEqual({ ok: false, errors: ["This check-in is skipped and can no longer resolve forecasts."] });
    });
  });

  describe("submitOutcomeNotes", () => {
    function notesForm(text: string): FormData {
      const fd = new FormData();
      fd.set("outcome_notes", text);
      return fd;
    }

    it("saves notes while the check-in is active", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      checkinUpdateEq.mockReturnValue({ error: null });
      const { submitOutcomeNotes } = await import("./checkin-actions");
      const result = await submitOutcomeNotes("c1", notesForm("went sideways"));
      expect(result).toEqual({ ok: true });
    });

    it("rejects editing a terminal (skipped) check-in", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "skipped" }, error: null });
      const { submitOutcomeNotes } = await import("./checkin-actions");
      const result = await submitOutcomeNotes("c1", notesForm("too late"));
      expect(result).toEqual({ ok: false, errors: ["This check-in is skipped and can no longer be edited."] });
    });
  });

  describe("addCheckinFailure", () => {
    function formWith(fields: Record<string, string>): FormData {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      return fd;
    }

    it("rejects a missing description", async () => {
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure("c1", formWith({ attribution: "skill" }));
      expect(result).toEqual({ ok: false, errors: ["A description is required."] });
    });

    it("rejects an invalid attribution", async () => {
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure("c1", formWith({ description: "d", attribution: "nope" }));
      expect(result.ok).toBe(false);
    });

    it("rejects once the check-in is already completed", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "completed" }, error: null });
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure("c1", formWith({ description: "d", attribution: "skill" }));
      expect(result).toEqual({ ok: false, errors: ["This check-in is completed and can no longer take failures."] });
    });

    it("rejects a skipped check-in (terminal state, DATA_MODEL rule 5)", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "skipped" }, error: null });
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure("c1", formWith({ description: "d", attribution: "skill" }));
      expect(result).toEqual({ ok: false, errors: ["This check-in is skipped and can no longer take failures."] });
    });

    it("inserts an unlisted failure with no linked risk", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      checkinFailuresInsert.mockResolvedValue({ error: null });
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure("c1", formWith({ description: "d", attribution: "luck" }));
      expect(result).toEqual({ ok: true });
      expect(checkinFailuresInsert).toHaveBeenCalledWith(
        expect.objectContaining({ linked_risk_id: null, was_knowable: false, attribution: "luck" }),
      );
    });

    it("rejects a linked risk belonging to a different decision (rule 4)", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      riskSingle.mockResolvedValue({ data: { id: "r1", premortem_id: "p1" }, error: null });
      premortemSingle.mockResolvedValue({ data: { decision_id: "d2" }, error: null });
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure(
        "c1",
        formWith({ description: "d", attribution: "mixed", linked_risk_id: "r1" }),
      );
      expect(result).toEqual({ ok: false, errors: ["Linked risk does not belong to this decision."] });
    });

    it("inserts a failure linked to a same-decision risk", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      riskSingle.mockResolvedValue({ data: { id: "r1", premortem_id: "p1" }, error: null });
      premortemSingle.mockResolvedValue({ data: { decision_id: "d1" }, error: null });
      checkinFailuresInsert.mockResolvedValue({ error: null });
      const { addCheckinFailure } = await import("./checkin-actions");
      const result = await addCheckinFailure(
        "c1",
        formWith({ description: "d", attribution: "mixed", linked_risk_id: "r1", was_knowable: "on" }),
      );
      expect(result).toEqual({ ok: true });
      expect(checkinFailuresInsert).toHaveBeenCalledWith(
        expect.objectContaining({ linked_risk_id: "r1", was_knowable: true }),
      );
    });
  });

  describe("completeCheckin", () => {
    function formWith(fields: Record<string, string>): FormData {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      return fd;
    }

    it("blocks completion without an overall attribution", async () => {
      const { completeCheckin } = await import("./checkin-actions");
      const result = await completeCheckin("c1", formWith({}));
      expect(result.ok).toBe(false);
    });

    it("rejects completing an already-completed check-in", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "completed" }, error: null });
      const { completeCheckin } = await import("./checkin-actions");
      const result = await completeCheckin("c1", formWith({ overall_attribution: "skill" }));
      expect(result).toEqual({ ok: false, errors: ["This check-in is completed and can no longer be completed."] });
    });

    it("rejects completing a skipped check-in (terminal state, DATA_MODEL rule 5)", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "skipped" }, error: null });
      const { completeCheckin } = await import("./checkin-actions");
      const result = await completeCheckin("c1", formWith({ overall_attribution: "skill" }));
      expect(result).toEqual({ ok: false, errors: ["This check-in is skipped and can no longer be completed."] });
    });

    it("completes the check-in with the given attribution", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      checkinUpdateInSelect.mockResolvedValue({ data: [{ id: "c1" }], error: null });
      const { completeCheckin } = await import("./checkin-actions");
      const result = await completeCheckin("c1", formWith({ overall_attribution: "mixed" }));
      expect(result).toEqual({ ok: true });
    });

    it("rejects when a concurrent completion wins the race (conditional update matches zero rows)", async () => {
      checkinSingle.mockResolvedValue({ data: { id: "c1", user_id: "u1", decision_id: "d1", status: "due" }, error: null });
      checkinUpdateInSelect.mockResolvedValue({ data: [], error: null });
      const { completeCheckin } = await import("./checkin-actions");
      const result = await completeCheckin("c1", formWith({ overall_attribution: "mixed" }));
      expect(result).toEqual({ ok: false, errors: ["This check-in is no longer active."] });
    });
  });
});
