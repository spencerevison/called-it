// T35 resolve_decision RPC — hits a REAL local Supabase instance.
// prereq: `supabase start` (docker), then `pnpm test:db`.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";

const svc = createServiceClient();

const user = { email: "resolve-test@example.com", password: "test-password-r1" };
let userId: string;

beforeAll(async () => {
  const { data, error } = await svc.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;
});

afterAll(async () => {
  await svc.auth.admin.deleteUser(userId);
});

async function makeActiveDecision() {
  const { data: decision, error } = await svc
    .from("decisions")
    .insert({ user_id: userId, title: "resolve test", context: "ctx", status: "active", decided_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error || !decision) throw error;

  const { error: checkinError } = await svc.from("checkins").insert([
    { user_id: userId, decision_id: decision.id, horizon: "two_weeks", scheduled_for: new Date().toISOString(), status: "pending" },
    { user_id: userId, decision_id: decision.id, horizon: "two_months", scheduled_for: new Date().toISOString(), status: "due" },
    { user_id: userId, decision_id: decision.id, horizon: "six_months", scheduled_for: new Date().toISOString(), status: "completed", overall_attribution: "skill", completed_at: new Date().toISOString() },
  ]);
  if (checkinError) throw checkinError;

  return decision.id;
}

describe("resolve_decision", () => {
  let decisionId: string;

  afterEach(async () => {
    if (!decisionId) return;
    await svc.from("checkins").delete().eq("decision_id", decisionId);
    await svc.from("decision_events").delete().eq("decision_id", decisionId);
    await svc.from("decisions").delete().eq("id", decisionId);
  });

  it("flips active -> resolved, sets resolved_at, logs the event, and skips pending/due checkins only", async () => {
    decisionId = await makeActiveDecision();

    const { error } = await svc.rpc("resolve_decision", {
      p_decision_id: decisionId,
      p_user_id: userId,
      p_status: "resolved",
    });
    expect(error).toBeNull();

    const { data: decision } = await svc.from("decisions").select("status, resolved_at").eq("id", decisionId).single();
    expect(decision!.status).toBe("resolved");
    expect(decision!.resolved_at).not.toBeNull();

    const { data: events } = await svc.from("decision_events").select("event_type").eq("decision_id", decisionId);
    expect(events!.map((e) => e.event_type)).toEqual(["resolved"]);

    const { data: checkins } = await svc.from("checkins").select("horizon, status").eq("decision_id", decisionId).order("horizon");
    const statusByHorizon = Object.fromEntries(checkins!.map((c) => [c.horizon, c.status]));
    expect(statusByHorizon.two_weeks).toBe("skipped");
    expect(statusByHorizon.two_months).toBe("skipped");
    expect(statusByHorizon.six_months).toBe("completed");
  });

  it("flips active -> abandoned and logs an abandoned event", async () => {
    decisionId = await makeActiveDecision();

    const { error } = await svc.rpc("resolve_decision", {
      p_decision_id: decisionId,
      p_user_id: userId,
      p_status: "abandoned",
    });
    expect(error).toBeNull();

    const { data: decision } = await svc.from("decisions").select("status").eq("id", decisionId).single();
    expect(decision!.status).toBe("abandoned");

    const { data: events } = await svc.from("decision_events").select("event_type").eq("decision_id", decisionId);
    expect(events!.map((e) => e.event_type)).toEqual(["abandoned"]);
  });

  it("rejects resolving a draft decision and leaves it untouched", async () => {
    const { data: decision, error } = await svc
      .from("decisions")
      .insert({ user_id: userId, title: "still draft", context: "ctx" })
      .select("id")
      .single();
    if (error || !decision) throw error;
    decisionId = decision.id;

    const { error: rpcError } = await svc.rpc("resolve_decision", {
      p_decision_id: decisionId,
      p_user_id: userId,
      p_status: "resolved",
    });
    expect(rpcError).not.toBeNull();

    const { data: row } = await svc.from("decisions").select("status").eq("id", decisionId).single();
    expect(row!.status).toBe("draft");
  });

  it("rejects a non-owner call and leaves the decision active with no terminal event", async () => {
    decisionId = await makeActiveDecision();

    const { error } = await svc.rpc("resolve_decision", {
      p_decision_id: decisionId,
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_status: "resolved",
    });
    expect(error).not.toBeNull();

    const { data: decision } = await svc.from("decisions").select("status").eq("id", decisionId).single();
    expect(decision!.status).toBe("active");

    const { data: events } = await svc.from("decision_events").select("id").eq("decision_id", decisionId);
    expect(events).toEqual([]);
  });

  it("rejects double-resolving an already-resolved decision", async () => {
    decisionId = await makeActiveDecision();

    const first = await svc.rpc("resolve_decision", { p_decision_id: decisionId, p_user_id: userId, p_status: "resolved" });
    expect(first.error).toBeNull();

    const second = await svc.rpc("resolve_decision", { p_decision_id: decisionId, p_user_id: userId, p_status: "abandoned" });
    expect(second.error).not.toBeNull();

    const { data: events } = await svc.from("decision_events").select("event_type").eq("decision_id", decisionId);
    expect(events!.map((e) => e.event_type)).toEqual(["resolved"]);
  });
});
