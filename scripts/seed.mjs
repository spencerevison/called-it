// T12 — seed a local dev dataset matching METRICS.md's aggregation-contract
// minimums (§Aggregation service contract). Idempotent: deletes the fixed
// seed user's rows and recreates them, so `pnpm db:seed` is safe to re-run.
//
// Requires `supabase start` (local stack) — reads .env.local same as
// vitest.config.db.ts does, since this isn't run through Next.js env loading.
//
// --- hand-computed metric values for this dataset (T20 integration test target) ---
// Below-min-n metrics (M3 n=2<5, M4 n=4<5, M6 n=3/4<5, M9 n=1/1<4) are
// EXPECTED to render "insufficient data" — that's intentional per the
// contract note, not a bug. Values below are what the pure functions should
// return before min-n gating is applied on top in T20.
//
//   M1 Brier (n=7):        1.48 / 7 = 0.21142857142857144
//   M2 calibration:        7 bins, each n=1 (all distinct tenths) —
//                          [0.2,0.3) p=0.2 o=0 · [0.3,0.4) p=0.3 o=1 ·
//                          [0.5,0.6) p=0.5 o=0 · [0.6,0.7) p=0.6 o=1 ·
//                          [0.7,0.8) p=0.7 o=0 · [0.8,0.9) p=0.8 o=1 ·
//                          [0.9,1.0] p=0.9 o=1
//   M3 hindsight bias (n=2, insufficient): mean(0.05, 0.05) = 0.05
//   M4 optimism bias (n=4 desired, insufficient): mean(p)=0.75, mean(o)=0.75 -> 0.0
//   M5 granularity (n=12, all forecasts): round10=9/12=0.75, round5=11/12=0.9166...,
//                          fifty=2/12=0.1666...
//   M6 horizon gap (short n=3, long n=4, both insufficient): long 0.3175 - short 0.07 = 0.2475
//   M7 options-considered (3 committed decisions, counts 2/4/3): mean = 3.0
//   M8 reversal frequency: 1/3 = 0.3333...; median days committed->reversed = 10
//   M9 self-serving index (1 good / 1 bad checkin, insufficient): 1.0 - 0.0 = 1.0
//   M10 pre-mortem surface (4 knowable failures, 2 linked): per-failure 2/4=0.5,
//                          per-decision 2/2=1.0
// -----------------------------------------------------------------------------

import { loadEnvLocal, serviceClient } from "./lib/bootstrap.mjs";

loadEnvLocal();
const svc = serviceClient();

const SEED_EMAIL = "seed@calledit.local";
const SEED_PASSWORD = "seed-password-1";
const PROMPT_VERSION_ID = "seed_premortem_v1";

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

async function findSeedUserId() {
  // ponytail: listUsers() + filter — fine for a handful of local dev users;
  // swap for a direct lookup if this seed script ever needs to scale.
  const { data, error } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === SEED_EMAIL)?.id ?? null;
}

async function wipeSeedUser(userId) {
  const tables = [
    "checkin_failures",
    "forecasts", // must precede checkins — forecasts.resolved_in_checkin_id FKs into it
    "checkins",
    "premortem_risks",
    "premortems",
    "decision_events",
    "decisions",
    "profiles",
  ];
  for (const table of tables) {
    const { error } = await svc.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
  await svc.auth.admin.deleteUser(userId);
}

async function main() {
  const existingId = await findSeedUserId();
  if (existingId) await wipeSeedUser(existingId);

  const { error: pvErr } = await svc.from("prompt_versions").upsert(
    {
      id: PROMPT_VERSION_ID,
      kind: "premortem",
      file_path: "prompts/premortem_v1.md",
      content_hash: "seed-hash",
    },
    { onConflict: "id" },
  );
  if (pvErr) throw pvErr;

  const { data: user, error: userErr } = await svc.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = user.user.id;

  const { error: profileErr } = await svc.from("profiles").insert({ user_id: userId });
  if (profileErr) throw profileErr;

  // --- decisions ---
  const decisionRows = [
    {
      key: "d1",
      title: "Take the new job offer",
      context: "Recruiter reached out with a lead role at a smaller company.",
      rationale: "More scope and equity upside outweighs the stability of staying.",
      options_considered: ["Stay at current job", "Take the new job"],
      chosen_option: "Take the new job",
      stakes: "high",
      reversibility: "one_way",
      status: "resolved",
      decided_at: daysAgo(150),
      resolved_at: daysAgo(5),
    },
    {
      key: "d2",
      title: "Redesign the onboarding flow",
      context: "Activation rate has been flat for two quarters.",
      rationale: "A/B testing would take too long given the runway left this quarter.",
      options_considered: [
        "Ship as-is",
        "Redesign fully",
        "A/B test two variants",
        "Delay a quarter",
      ],
      chosen_option: "Redesign fully",
      stakes: "medium",
      reversibility: "two_way",
      status: "active",
      decided_at: daysAgo(100),
      resolved_at: null,
    },
    {
      key: "d3",
      title: "Switch primary bank",
      context: "Current bank raised fees and support has been slow.",
      rationale: "Bank B's business account terms are strictly better on paper.",
      options_considered: ["Stay with current bank", "Switch to Bank B", "Switch to credit union"],
      chosen_option: "Switch to Bank B",
      stakes: "medium",
      reversibility: "two_way",
      status: "resolved",
      decided_at: daysAgo(140),
      resolved_at: daysAgo(3),
    },
  ];

  const decisionIds = {};
  for (const row of decisionRows) {
    const { key, ...insertRow } = row;
    const { data, error } = await svc
      .from("decisions")
      .insert({ user_id: userId, ...insertRow })
      .select("id")
      .single();
    if (error) throw error;
    decisionIds[key] = data.id;
  }

  await svc.from("decision_events").insert([
    { user_id: userId, decision_id: decisionIds.d1, event_type: "created", created_at: daysAgo(151) },
    { user_id: userId, decision_id: decisionIds.d1, event_type: "committed", created_at: daysAgo(150) },
    { user_id: userId, decision_id: decisionIds.d1, event_type: "resolved", created_at: daysAgo(5) },

    { user_id: userId, decision_id: decisionIds.d2, event_type: "created", created_at: daysAgo(101) },
    { user_id: userId, decision_id: decisionIds.d2, event_type: "committed", created_at: daysAgo(100) },
    { user_id: userId, decision_id: decisionIds.d2, event_type: "reversed", created_at: daysAgo(90) },

    { user_id: userId, decision_id: decisionIds.d3, event_type: "created", created_at: daysAgo(141) },
    { user_id: userId, decision_id: decisionIds.d3, event_type: "committed", created_at: daysAgo(140) },
    { user_id: userId, decision_id: decisionIds.d3, event_type: "resolved", created_at: daysAgo(3) },
  ]);

  // --- premortems + risks (for M10 linking) ---
  const { data: pmD1, error: pmD1Err } = await svc
    .from("premortems")
    .insert({ user_id: userId, decision_id: decisionIds.d1, prompt_version: PROMPT_VERSION_ID, model: "seed-model" })
    .select("id")
    .single();
  if (pmD1Err) throw pmD1Err;

  const { data: pmD3, error: pmD3Err } = await svc
    .from("premortems")
    .insert({ user_id: userId, decision_id: decisionIds.d3, prompt_version: PROMPT_VERSION_ID, model: "seed-model" })
    .select("id")
    .single();
  if (pmD3Err) throw pmD3Err;

  const { data: riskD1, error: riskD1Err } = await svc
    .from("premortem_risks")
    .insert([
      { user_id: userId, premortem_id: pmD1.id, description: "New role turns out to be mostly maintenance work", category: "information", severity: "medium" },
      { user_id: userId, premortem_id: pmD1.id, description: "Company runs out of runway within a year", category: "external", severity: "high" },
    ])
    .select("id");
  if (riskD1Err) throw riskD1Err;

  const { data: riskD3, error: riskD3Err } = await svc
    .from("premortem_risks")
    .insert([
      { user_id: userId, premortem_id: pmD3.id, description: "Bank B's onboarding takes longer than quoted", category: "execution", severity: "low" },
      { user_id: userId, premortem_id: pmD3.id, description: "Business gets flagged during KYC review", category: "external", severity: "medium" },
    ])
    .select("id");
  if (riskD3Err) throw riskD3Err;

  // --- checkins (2 completed, M9 valence + M10 linking) ---
  const { data: checkinA, error: checkinAErr } = await svc
    .from("checkins")
    .insert({
      user_id: userId,
      decision_id: decisionIds.d1,
      horizon: "six_months",
      scheduled_for: daysAgo(6),
      status: "completed",
      overall_attribution: "skill",
      outcome_notes: "New role has been a clear step up so far.",
      completed_at: daysAgo(5),
    })
    .select("id")
    .single();
  if (checkinAErr) throw checkinAErr;

  const { data: checkinB, error: checkinBErr } = await svc
    .from("checkins")
    .insert({
      user_id: userId,
      decision_id: decisionIds.d3,
      horizon: "six_months",
      scheduled_for: daysAgo(4),
      status: "completed",
      overall_attribution: "luck",
      outcome_notes: "The switch has been a mixed bag.",
      completed_at: daysAgo(3),
    })
    .select("id")
    .single();
  if (checkinBErr) throw checkinBErr;

  await svc.from("checkin_failures").insert([
    { user_id: userId, checkin_id: checkinA.id, description: "Onboarding at the new company took twice as long as expected", linked_risk_id: riskD1[0].id, was_knowable: true, attribution: "luck" },
    { user_id: userId, checkin_id: checkinA.id, description: "Old team poached two of the projects I wanted to keep", linked_risk_id: null, was_knowable: true, attribution: "mixed" },
    { user_id: userId, checkin_id: checkinB.id, description: "KYC review flagged the account, delaying the switch by weeks", linked_risk_id: riskD3[0].id, was_knowable: true, attribution: "skill" },
    { user_id: userId, checkin_id: checkinB.id, description: "Wire transfer limits were lower than advertised", linked_risk_id: null, was_knowable: true, attribution: "luck" },
  ]);

  // --- forecasts: 7 resolved (F1-F7) + 5 unresolved (U1-U5) = 12 ---
  const resolvedForecasts = [
    { key: "f1", decision_id: decisionIds.d1, question: "Will I still enjoy the new role after 6 months?", probability: 0.9, desired: true, outcome: true, created_at: daysAgo(15), resolved_at: daysAgo(5), resolved_in_checkin_id: checkinA.id },
    { key: "f2", decision_id: decisionIds.d1, question: "Will the new company still be funded in 6 months?", probability: 0.6, desired: true, outcome: true, created_at: daysAgo(15), resolved_at: daysAgo(5), resolved_in_checkin_id: checkinA.id },
    { key: "f3", decision_id: decisionIds.d1, question: "Will I regret leaving my old team?", probability: 0.2, desired: false, outcome: false, created_at: daysAgo(125), resolved_at: daysAgo(5), resolved_in_checkin_id: checkinA.id },
    { key: "f4", decision_id: decisionIds.d1, question: "Will the commute become a problem?", probability: 0.5, desired: false, outcome: false, created_at: daysAgo(125), resolved_at: daysAgo(5), resolved_in_checkin_id: checkinA.id },
    { key: "f5", decision_id: decisionIds.d3, question: "Will Bank B's fees stay lower than my current bank's?", probability: 0.8, desired: true, outcome: true, created_at: daysAgo(13), resolved_at: daysAgo(3), resolved_in_checkin_id: checkinB.id, recalled_probability: 0.85 },
    { key: "f6", decision_id: decisionIds.d3, question: "Will the switch complete within a month?", probability: 0.7, desired: true, outcome: false, created_at: daysAgo(123), resolved_at: daysAgo(3), resolved_in_checkin_id: checkinB.id },
    { key: "f7", decision_id: decisionIds.d3, question: "Will I need to keep the old account open as a backup?", probability: 0.3, desired: false, outcome: true, created_at: daysAgo(123), resolved_at: daysAgo(3), resolved_in_checkin_id: checkinB.id, recalled_probability: 0.35 },
  ];

  for (const f of resolvedForecasts) {
    const { recalled_probability, ...rest } = f;
    delete rest.key; // "key" is just a label for the header comment above, not a column
    const resolvedAtMs = Date.parse(rest.resolved_at);
    const insertRow = {
      user_id: userId,
      resolved: true,
      revealed_at: rest.resolved_at,
      ...rest,
    };
    if (recalled_probability !== undefined) {
      insertRow.recalled_probability = recalled_probability;
      insertRow.recalled_at = new Date(resolvedAtMs - 3600000).toISOString();
    }
    const { error } = await svc.from("forecasts").insert(insertRow);
    if (error) throw error;
  }

  const unresolvedForecasts = [
    { decision_id: decisionIds.d1, question: "Will I get promoted within a year?", probability: 0.5, desired: true, resolve_by: daysAgo(-180).slice(0, 10) },
    { decision_id: decisionIds.d2, question: "Will the redesign lift activation by 10%?", probability: 0.65, desired: true, resolve_by: daysAgo(-60).slice(0, 10) },
    { decision_id: decisionIds.d2, question: "Will engineering push back on scope?", probability: 0.72, desired: false, resolve_by: daysAgo(-30).slice(0, 10) },
    { decision_id: decisionIds.d3, question: "Will I open a second account elsewhere too?", probability: 0.4, desired: false, resolve_by: daysAgo(-90).slice(0, 10) },
    { decision_id: decisionIds.d1, question: "Will I still be at this company in 2 years?", probability: 0.55, desired: true, resolve_by: daysAgo(-365).slice(0, 10) },
  ];

  const { error: unresolvedErr } = await svc
    .from("forecasts")
    .insert(unresolvedForecasts.map((f) => ({ user_id: userId, ...f })));
  if (unresolvedErr) throw unresolvedErr;

  console.log(`seeded user ${SEED_EMAIL} (${userId}) with 3 decisions, 12 forecasts, 2 completed check-ins.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
