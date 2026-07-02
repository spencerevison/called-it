// T12 -- dev seed for the local Supabase instance. Requires `supabase start`.
// Wipes and re-inserts a fixed-id dataset for a deterministic seed user, so
// re-running is idempotent (delete-then-insert, not upsert-in-place).
//
// This dataset is the fixture the T20 aggregation-service integration test
// asserts against -- the hand-computed values below MUST stay in sync with
// the rows inserted further down. See METRICS.md "Aggregation service
// contract" for the minimums this seed is required to hit.
//
// Hand-computed metric values for this seed (userId = SEED_USER_EMAIL):
//
//   M1 Brier            = 0.68 / 7 = 0.09714285714285714   (7 resolved forecasts)
//   M2 calibration bins = 7 bins, n=1 each (below display min-n=5, still output):
//                         [0.2,0.3) p=0.2 o=0 | [0.3,0.4) p=0.3 o=0 | [0.5,0.6) p=0.5 o=0
//                         [0.6,0.7) p=0.6 o=1 | [0.7,0.8) p=0.7 o=1 | [0.8,0.9) p=0.8 o=1
//                         [0.9,1.0] p=0.9 o=1
//   M3 hindsight        = insufficient data (2 recalled pairs, needs 5)
//   M4 optimism         = insufficient data (4 desired resolved, needs 5)
//   M5 granularity      = round10Rate=10/12=0.8333333333333334, round5Rate=12/12=1,
//                         fiftyRate=2/12=0.16666666666666666   (all 12 forecasts)
//   M6 horizon gap      = insufficient data (4 short / 3 long, needs 5/side)
//   M7 options count    = (2+4+3+3)/4 = 3.0                (4 committed decisions)
//   M8 reversal freq    = 1/4 = 0.25; median days committed->reversed = 10
//   M9 self-serving     = insufficient data (2 completed check-ins, needs 4/side)
//   M10 surface rate    = per-failure 2/4 = 0.5; per-decision 2/2 = 1.0

import { createClient } from "@supabase/supabase-js"
import setupLocalSupabaseEnv from "../src/lib/supabase/test/global-setup.db"
import { supabaseServiceRoleKey, supabaseUrl } from "../src/lib/supabase/env"

setupLocalSupabaseEnv()

const admin = createClient(supabaseUrl(), supabaseServiceRoleKey())

const SEED_USER_EMAIL = "seed@calledit.local"

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString()

const D1 = "11111111-1111-1111-1111-111111111101"
const D2 = "11111111-1111-1111-1111-111111111102"
const D3 = "11111111-1111-1111-1111-111111111103"
const D4 = "11111111-1111-1111-1111-111111111104"

const P3 = "33333333-3333-3333-3333-333333333103"
const P4 = "33333333-3333-3333-3333-333333333104"
const R3 = "44444444-4444-4444-4444-444444444103"
const R4 = "44444444-4444-4444-4444-444444444104"
const C3 = "55555555-5555-5555-5555-555555555103"
const C4 = "55555555-5555-5555-5555-555555555104"

async function getOrCreateSeedUserId(): Promise<string> {
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) throw listErr
  const found = existing.users.find((u) => u.email === SEED_USER_EMAIL)
  if (found) return found.id

  const { data, error } = await admin.auth.admin.createUser({
    email: SEED_USER_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  const userId = await getOrCreateSeedUserId()

  // Idempotent reset -- decision_id FKs cascade, wiping events/forecasts/
  // premortems/risks/checkins/failures in one go.
  const { error: wipeErr } = await admin.from("decisions").delete().eq("user_id", userId)
  if (wipeErr) throw wipeErr

  const { error: decisionsErr } = await admin.from("decisions").insert([
    {
      id: D1,
      user_id: userId,
      title: "Switch the team to a 4-day workweek pilot",
      context: "Team burnout is rising; leadership wants a productivity experiment.",
      options_considered: ["Keep 5-day week", "Pilot 4-day week for one quarter"],
      chosen_option: "Pilot 4-day week for one quarter",
      status: "active",
      decided_at: daysAgo(45),
    },
    {
      id: D2,
      user_id: userId,
      title: "Migrate the primary database to a new provider",
      context: "Current provider's pricing tripled at renewal.",
      options_considered: ["Stay and renegotiate", "Migrate to provider A", "Migrate to provider B", "Self-host"],
      chosen_option: "Migrate to provider A",
      status: "resolved",
      decided_at: daysAgo(60),
      resolved_at: daysAgo(5),
    },
    {
      id: D3,
      user_id: userId,
      title: "Launch the referral program before the holidays",
      context: "Growth is flat; marketing wants a lever before Q4 close.",
      options_considered: ["Delay to next quarter", "Launch as scoped", "Launch a smaller pilot"],
      chosen_option: "Launch as scoped",
      status: "resolved",
      decided_at: daysAgo(120),
      resolved_at: daysAgo(20),
    },
    {
      id: D4,
      user_id: userId,
      title: "Hire a contractor instead of a full-time engineer",
      context: "Backlog is growing faster than the team can absorb headcount.",
      options_considered: ["Hire full-time", "Hire contractor", "Redistribute existing team"],
      chosen_option: "Hire contractor",
      status: "resolved",
      decided_at: daysAgo(150),
      resolved_at: daysAgo(30),
    },
  ])
  if (decisionsErr) throw decisionsErr

  const { error: eventsErr } = await admin.from("decision_events").insert([
    { user_id: userId, decision_id: D1, event_type: "created", payload: {}, created_at: daysAgo(46) },
    { user_id: userId, decision_id: D1, event_type: "committed", payload: {}, created_at: daysAgo(45) },
    { user_id: userId, decision_id: D2, event_type: "created", payload: {}, created_at: daysAgo(61) },
    { user_id: userId, decision_id: D2, event_type: "committed", payload: {}, created_at: daysAgo(60) },
    // reversal 10 days after commit -- feeds M8's median-days companion
    { user_id: userId, decision_id: D2, event_type: "reversed", payload: { note: "Provider A's migration tooling broke on our schema" }, created_at: daysAgo(50) },
    { user_id: userId, decision_id: D3, event_type: "created", payload: {}, created_at: daysAgo(121) },
    { user_id: userId, decision_id: D3, event_type: "committed", payload: {}, created_at: daysAgo(120) },
    { user_id: userId, decision_id: D3, event_type: "resolved", payload: {}, created_at: daysAgo(20) },
    { user_id: userId, decision_id: D4, event_type: "created", payload: {}, created_at: daysAgo(151) },
    { user_id: userId, decision_id: D4, event_type: "committed", payload: {}, created_at: daysAgo(150) },
    { user_id: userId, decision_id: D4, event_type: "resolved", payload: {}, created_at: daysAgo(30) },
  ])
  if (eventsErr) throw eventsErr

  // 12 forecasts, 7 resolved -- p/o pairs chosen so M1/M2 hand-values above
  // are exact. Horizon: short = resolved_at - created_at <= 30d, long > 90d.
  const { error: forecastsErr } = await admin.from("forecasts").insert([
    // -- D1 (still active): 3 open forecasts, feed M5 only
    { user_id: userId, decision_id: D1, question: "Will output per person stay flat or improve?", probability: 0.75, desired: true, resolved: false, created_at: daysAgo(15) },
    { user_id: userId, decision_id: D1, question: "Will attrition drop this quarter?", probability: 0.4, desired: false, resolved: false, created_at: daysAgo(15) },
    { user_id: userId, decision_id: D1, question: "Will client SLAs still be met?", probability: 0.6, desired: true, resolved: false, created_at: daysAgo(15) },
    // -- D2: 2 resolved (short horizon) + 1 open
    {
      user_id: userId, decision_id: D2, question: "Will the migration finish before renewal?",
      probability: 0.9, desired: true, resolved: true, outcome: true,
      created_at: daysAgo(40), resolved_at: daysAgo(20),
    },
    {
      user_id: userId, decision_id: D2, question: "Will read latency improve post-migration?",
      probability: 0.7, desired: true, resolved: true, outcome: true, recalled_probability: 0.8,
      created_at: daysAgo(30), resolved_at: daysAgo(10),
    },
    { user_id: userId, decision_id: D2, question: "Will support tickets spike during cutover?", probability: 0.5, desired: true, resolved: false, created_at: daysAgo(15) },
    // -- D3: 2 resolved (1 short, 1 long) + 1 open
    {
      user_id: userId, decision_id: D3, question: "Will referral signups beat last year's holiday push?",
      probability: 0.6, desired: true, resolved: true, outcome: true,
      created_at: daysAgo(40), resolved_at: daysAgo(20),
    },
    {
      user_id: userId, decision_id: D3, question: "Will referral fraud stay under 2%?",
      probability: 0.2, desired: false, resolved: true, outcome: false,
      created_at: daysAgo(200), resolved_at: daysAgo(90),
    },
    { user_id: userId, decision_id: D3, question: "Will CAC drop below last quarter's average?", probability: 0.85, desired: false, resolved: false, created_at: daysAgo(15) },
    // -- D4: 3 resolved (1 short, 2 long)
    {
      user_id: userId, decision_id: D4, question: "Will the contractor cost more than a hire by month 6?",
      probability: 0.5, desired: false, resolved: true, outcome: false,
      created_at: daysAgo(200), resolved_at: daysAgo(90),
    },
    {
      user_id: userId, decision_id: D4, question: "Will the backlog burn down within a month?",
      probability: 0.3, desired: false, resolved: true, outcome: false, recalled_probability: 0.25,
      created_at: daysAgo(200), resolved_at: daysAgo(90),
    },
    {
      user_id: userId, decision_id: D4, question: "Will the contractor ramp up within two weeks?",
      probability: 0.8, desired: true, resolved: true, outcome: true,
      created_at: daysAgo(40), resolved_at: daysAgo(20),
    },
  ])
  if (forecastsErr) throw forecastsErr

  const { error: premortemsErr } = await admin.from("premortems").insert([
    { id: P3, user_id: userId, decision_id: D3, prompt_version: "premortem_v1", model: "claude-sonnet-5", created_at: daysAgo(121) },
    { id: P4, user_id: userId, decision_id: D4, prompt_version: "premortem_v1", model: "claude-sonnet-5", created_at: daysAgo(151) },
  ])
  if (premortemsErr) throw premortemsErr

  const { error: risksErr } = await admin.from("premortem_risks").insert([
    { id: R3, user_id: userId, premortem_id: P3, description: "A competitor launches a similar referral program first", category: "external", severity: "medium", source: "ai" },
    { id: R4, user_id: userId, premortem_id: P4, description: "Budget gets cut mid-engagement", category: "external", severity: "medium", source: "ai" },
  ])
  if (risksErr) throw risksErr

  const { error: checkinsErr } = await admin.from("checkins").insert([
    {
      id: C3, user_id: userId, decision_id: D3, horizon: "six_months", scheduled_for: daysAgo(21),
      status: "completed", overall_attribution: "skill", completed_at: daysAgo(20),
      outcome_notes: "Signups beat target, but fraud crept above plan.",
    },
    {
      id: C4, user_id: userId, decision_id: D4, horizon: "two_months", scheduled_for: daysAgo(31),
      status: "completed", overall_attribution: "luck", completed_at: daysAgo(30),
      outcome_notes: "Contractor ramped fast, but the budget got cut before month 6.",
    },
  ])
  if (checkinsErr) throw checkinsErr

  // 4 knowable failures (2 linked, 2 unlisted) + 1 unknowable (excluded from M10)
  const { error: failuresErr } = await admin.from("checkin_failures").insert([
    { user_id: userId, checkin_id: C3, description: "A competitor launched a similar referral program first", linked_risk_id: R3, was_knowable: true, attribution: "skill" },
    { user_id: userId, checkin_id: C3, description: "Onboarding friction was worse than expected", linked_risk_id: null, was_knowable: true, attribution: "luck" },
    { user_id: userId, checkin_id: C4, description: "Budget got cut mid-engagement", linked_risk_id: R4, was_knowable: true, attribution: "luck" },
    { user_id: userId, checkin_id: C4, description: "A key vendor missed a deadline", linked_risk_id: null, was_knowable: true, attribution: "mixed" },
    { user_id: userId, checkin_id: C4, description: "A regulatory rule changed unexpectedly", linked_risk_id: null, was_knowable: false, attribution: "luck" },
  ])
  if (failuresErr) throw failuresErr

  console.log(`Seed complete for ${SEED_USER_EMAIL} (${userId})`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
