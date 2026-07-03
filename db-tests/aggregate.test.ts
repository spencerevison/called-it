// T20 — exercises the thin Supabase-backed MetricsRowFetcher against a REAL
// local Supabase instance, seeded via `pnpm db:seed` (scripts/seed.mjs).
// prereq: `supabase start` + `pnpm db:seed`, then `pnpm test:db`. Not part of
// `pnpm check` / CI. Expected values are the seed script's header comment —
// same target the in-memory fixture test (src/lib/metrics/aggregate.test.ts)
// validates, this just proves the live row -> input mapping matches it too.
import { describe, expect, it, beforeAll } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { createSupabaseMetricsFetcher } from "@/lib/metrics/supabase-fetcher";
import { getDashboardMetrics } from "@/lib/metrics/aggregate";

const SEED_EMAIL = "seed@calledit.local";
const svc = createServiceClient();

let seedUserId: string;

beforeAll(async () => {
  const { data, error } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === SEED_EMAIL);
  if (!user) throw new Error(`seed user not found — run 'pnpm db:seed' first`);
  seedUserId = user.id;
});

describe("getDashboardMetrics (live seed data)", () => {
  it("matches the T12 seed header hand-computed values", async () => {
    const fetcher = createSupabaseMetricsFetcher(svc);
    const m = await getDashboardMetrics(seedUserId, fetcher);

    expect(m.brier.value).toBeCloseTo(1.48 / 7, 9);
    expect(m.calibrationCurve).toHaveLength(7);

    expect(m.hindsightBias.n).toBe(2);
    expect(m.hindsightBias.value).toBeNull();

    expect(m.optimismBias.desired.n).toBe(4);
    expect(m.optimismBias.desired.value).toBeNull();

    expect(m.granularity.n).toBe(12);
    expect(m.granularity.round10Rate).toBeCloseTo(9 / 12, 9);

    expect(m.horizonGap.shortN).toBe(3);
    expect(m.horizonGap.longN).toBe(4);
    expect(m.horizonGap.value).toBeNull();

    expect(m.optionsConsidered.n).toBe(3);
    expect(m.optionsConsidered.value).toBeCloseTo(3.0, 9);

    expect(m.reversal.value).toBeCloseTo(1 / 3, 9);
    expect(m.reversal.medianDaysToReversal).toBeCloseTo(10, 9);

    expect(m.selfServing.goodN).toBe(1);
    expect(m.selfServing.badN).toBe(1);
    expect(m.selfServing.value).toBeNull();

    expect(m.premortemSurface.perFailure.value).toBeCloseTo(0.5, 9);
    expect(m.premortemSurface.perDecision.value).toBeCloseTo(1.0, 9);
  });
});
