// T20 — thin Supabase-backed implementation of MetricsRowFetcher. Exercised by
// pnpm test:db (real local stack), not pnpm check — same split as db-tests/rls.test.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  MetricsRowFetcher,
  DecisionRow,
  DecisionEventRow,
  ForecastRow,
  CheckinRow,
  KnowableFailureRow,
} from "./aggregate";

export function createSupabaseMetricsFetcher(client: SupabaseClient<Database>): MetricsRowFetcher {
  return {
    async getDecisions(userId): Promise<DecisionRow[]> {
      const { data, error } = await client
        .from("decisions")
        .select("id, decided_at, options_considered")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        decidedAt: d.decided_at,
        optionsConsidered: (d.options_considered as string[] | null) ?? [],
      }));
    },

    async getDecisionEvents(userId): Promise<DecisionEventRow[]> {
      const { data, error } = await client
        .from("decision_events")
        .select("decision_id, event_type, created_at")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((e) => ({
        decisionId: e.decision_id,
        eventType: e.event_type,
        createdAt: e.created_at,
      }));
    },

    async getForecasts(userId): Promise<ForecastRow[]> {
      const { data, error } = await client
        .from("forecasts")
        .select(
          "probability, outcome, resolved, desired, created_at, resolved_at, recalled_probability, resolved_in_checkin_id"
        )
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((f) => ({
        probability: f.probability,
        outcome: f.outcome,
        resolved: f.resolved,
        desired: f.desired,
        createdAt: f.created_at,
        resolvedAt: f.resolved_at,
        recalledProbability: f.recalled_probability,
        resolvedInCheckinId: f.resolved_in_checkin_id,
      }));
    },

    async getCompletedCheckins(userId): Promise<CheckinRow[]> {
      const { data, error } = await client
        .from("checkins")
        .select("id, overall_attribution")
        .eq("user_id", userId)
        .eq("status", "completed");
      if (error) throw error;
      return (data ?? []).map((c) => ({ id: c.id, overallAttribution: c.overall_attribution }));
    },

    async getKnowableFailures(userId): Promise<KnowableFailureRow[]> {
      // checkin_failures has no decision_id column directly — join through
      // checkins to get it, and to filter down to resolved decisions only
      const { data, error } = await client
        .from("checkin_failures")
        .select("linked_risk_id, was_knowable, checkins!inner(decision_id, decisions!inner(status))")
        .eq("user_id", userId)
        .eq("was_knowable", true)
        .eq("checkins.decisions.status", "resolved");
      if (error) throw error;
      return (data ?? []).map((f) => ({
        decisionId: (f.checkins as unknown as { decision_id: string }).decision_id,
        linkedRiskId: f.linked_risk_id,
      }));
    },
  };
}
