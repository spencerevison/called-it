// T11 RLS policy tests — hits a REAL local Supabase instance.
// prereq: `supabase start` (docker), then `pnpm test:db`. Not part of
// `pnpm check` / CI — no docker in that environment. Env comes from
// .env.local (see vitest.config.db.ts), which points at the local stack.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// every table carrying user_id + RLS from the T11 migration
const USER_TABLES = [
  "profiles",
  "decisions",
  "decision_events",
  "forecasts",
  "premortems",
  "premortem_risks",
  "checkins",
  "checkin_failures",
  "judge_scores",
] as const;

function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signedInClient(email: string, password: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const svc = createServiceClient();

const userA = { email: "rls-test-a@example.com", password: "test-password-a1" };
const userB = { email: "rls-test-b@example.com", password: "test-password-b1" };
let userAId: string;
let userBId: string;
let decisionAId: string;
let premortemAId: string;
let checkinAId: string;

beforeAll(async () => {
  const { data: a, error: aErr } = await svc.auth.admin.createUser({
    email: userA.email,
    password: userA.password,
    email_confirm: true,
  });
  if (aErr) throw aErr;
  userAId = a.user.id;

  const { data: b, error: bErr } = await svc.auth.admin.createUser({
    email: userB.email,
    password: userB.password,
    email_confirm: true,
  });
  if (bErr) throw bErr;
  userBId = b.user.id;

  await svc.from("prompt_versions").insert({
    id: "rls_test_pv_1",
    kind: "premortem",
    file_path: "prompts/rls_test_pv_1.md",
    content_hash: "deadbeef",
  });

  const { data: decision, error: decErr } = await svc
    .from("decisions")
    .insert({ user_id: userAId, title: "rls test", context: "ctx" })
    .select("id")
    .single();
  if (decErr) throw decErr;
  decisionAId = decision.id;

  await svc.from("profiles").insert({ user_id: userAId });
  await svc.from("decision_events").insert({
    user_id: userAId,
    decision_id: decisionAId,
    event_type: "created",
  });
  await svc.from("forecasts").insert({
    user_id: userAId,
    decision_id: decisionAId,
    question: "will it rain",
    probability: 0.5,
  });

  const { data: premortem, error: pmErr } = await svc
    .from("premortems")
    .insert({
      user_id: userAId,
      decision_id: decisionAId,
      prompt_version: "rls_test_pv_1",
      model: "test-model",
    })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  premortemAId = premortem.id;

  await svc.from("premortem_risks").insert({
    user_id: userAId,
    premortem_id: premortemAId,
    description: "risk",
    category: "execution",
    severity: "low",
  });

  const { data: checkin, error: ciErr } = await svc
    .from("checkins")
    .insert({
      user_id: userAId,
      decision_id: decisionAId,
      horizon: "custom",
      scheduled_for: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ciErr) throw ciErr;
  checkinAId = checkin.id;

  await svc.from("checkin_failures").insert({
    user_id: userAId,
    checkin_id: checkinAId,
    description: "failure",
    attribution: "luck",
  });

  await svc.from("judge_scores").insert({
    user_id: userAId,
    decision_id: decisionAId,
    prompt_version: "rls_test_pv_1",
    model: "test-model",
    input_hash: "deadbeef",
    scores: {},
    rationale: {},
  });

  await svc.from("eval_items").insert({ id: "rls-test-item", payload: {} });
  await svc.from("eval_runs").insert({ kind: "judge_agreement", prompt_versions: [], metrics: {} });
});

afterAll(async () => {
  // reverse dependency order — FKs to auth.users have no cascade
  await svc.from("eval_runs").delete().eq("kind", "judge_agreement");
  await svc.from("eval_items").delete().eq("id", "rls-test-item");
  await svc.from("judge_scores").delete().eq("decision_id", decisionAId);
  await svc.from("checkin_failures").delete().eq("checkin_id", checkinAId);
  await svc.from("checkins").delete().eq("id", checkinAId);
  await svc.from("premortem_risks").delete().eq("premortem_id", premortemAId);
  await svc.from("premortems").delete().eq("id", premortemAId);
  await svc.from("forecasts").delete().eq("decision_id", decisionAId);
  await svc.from("decision_events").delete().eq("decision_id", decisionAId);
  await svc.from("decisions").delete().eq("id", decisionAId);
  await svc.from("profiles").delete().eq("user_id", userAId);
  await svc.from("prompt_versions").delete().eq("id", "rls_test_pv_1");
  await svc.auth.admin.deleteUser(userAId);
  await svc.auth.admin.deleteUser(userBId);
});

describe("RLS — anon", () => {
  it("reads zero rows on every user table", async () => {
    const client = anonClient();
    for (const table of USER_TABLES) {
      const { data, error } = await client.from(table).select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("reads zero rows on eval tables", async () => {
    const client = anonClient();
    const items = await client.from("eval_items").select("*");
    const runs = await client.from("eval_runs").select("*");
    expect(items.data).toEqual([]);
    expect(runs.data).toEqual([]);
  });

  it("reads zero rows on prompt_versions (authenticated-only, not anon)", async () => {
    const client = anonClient();
    const { data } = await client.from("prompt_versions").select("*");
    expect(data).toEqual([]);
  });
});

describe("RLS — authenticated", () => {
  it("user A reads their own row on every user table", async () => {
    const client = await signedInClient(userA.email, userA.password);
    for (const table of USER_TABLES) {
      const { data, error } = await client.from(table).select("*");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    }
  });

  it("user B cannot read user A's rows on any user table", async () => {
    const client = await signedInClient(userB.email, userB.password);
    for (const table of USER_TABLES) {
      const { data, error } = await client.from(table).select("*");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("reads zero rows on eval tables", async () => {
    const client = await signedInClient(userA.email, userA.password);
    const items = await client.from("eval_items").select("*");
    const runs = await client.from("eval_runs").select("*");
    expect(items.data).toEqual([]);
    expect(runs.data).toEqual([]);
  });

  it("reads prompt_versions", async () => {
    const client = await signedInClient(userA.email, userA.password);
    const { data, error } = await client.from("prompt_versions").select("*").eq("id", "rls_test_pv_1");
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("cannot insert into a user table directly", async () => {
    const client = await signedInClient(userA.email, userA.password);
    const { error } = await client
      .from("decisions")
      .insert({ user_id: userAId, title: "direct write", context: "ctx" });
    expect(error).not.toBeNull();
  });

  it("cannot update a row it owns directly", async () => {
    const client = await signedInClient(userA.email, userA.password);
    // no UPDATE policy — RLS filters the row out of the update target, so
    // the request succeeds but affects zero rows (RLS filters silently on
    // UPDATE/DELETE; only INSERT hard-errors on a denied write)
    const { data: updated } = await client
      .from("decisions")
      .update({ title: "hijacked" })
      .eq("id", decisionAId)
      .select();
    expect(updated).toEqual([]);

    const { data } = await svc.from("decisions").select("title").eq("id", decisionAId).single();
    expect(data!.title).toBe("rls test");
  });
});
