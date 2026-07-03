// T26 commit_decision RPC — hits a REAL local Supabase instance.
// prereq: `supabase start` (docker), then `pnpm test:db`.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";

const svc = createServiceClient();

const user = { email: "commit-test@example.com", password: "test-password-c1" };
let userId: string;

const CHECKIN_DATES = {
  p_two_weeks: "2026-07-17T09:00:00.000Z",
  p_two_months: "2026-09-03T09:00:00.000Z",
  p_six_months: "2027-01-03T09:00:00.000Z",
};

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

async function makeDraftDecision() {
  const { data, error } = await svc
    .from("decisions")
    .insert({ user_id: userId, title: "commit test", context: "ctx" })
    .select("id")
    .single();
  if (error || !data) throw error;
  return data.id;
}

describe("commit_decision", () => {
  let decisionId: string;

  afterEach(async () => {
    if (!decisionId) return;
    await svc.from("checkins").delete().eq("decision_id", decisionId);
    await svc.from("decision_events").delete().eq("decision_id", decisionId);
    await svc.from("decisions").delete().eq("id", decisionId);
  });

  it("flips draft -> active, sets decided_at, writes the committed event and 3 checkins", async () => {
    decisionId = await makeDraftDecision();

    const { error } = await svc.rpc("commit_decision", {
      p_decision_id: decisionId,
      p_user_id: userId,
      ...CHECKIN_DATES,
    });
    expect(error).toBeNull();

    const { data: decision } = await svc
      .from("decisions")
      .select("status, decided_at")
      .eq("id", decisionId)
      .single();
    expect(decision!.status).toBe("active");
    expect(decision!.decided_at).not.toBeNull();

    const { data: events } = await svc
      .from("decision_events")
      .select("event_type")
      .eq("decision_id", decisionId);
    expect(events!.map((e) => e.event_type)).toEqual(["committed"]);

    const { data: checkins } = await svc
      .from("checkins")
      .select("horizon, status")
      .eq("decision_id", decisionId)
      .order("horizon");
    expect(checkins!.length).toBe(3);
    expect(checkins!.every((c) => c.status === "pending")).toBe(true);
    expect(checkins!.map((c) => c.horizon).sort()).toEqual(["six_months", "two_months", "two_weeks"]);
  });

  it("rejects committing an already-active decision and leaves it untouched (no double checkins)", async () => {
    decisionId = await makeDraftDecision();

    const first = await svc.rpc("commit_decision", { p_decision_id: decisionId, p_user_id: userId, ...CHECKIN_DATES });
    expect(first.error).toBeNull();

    const second = await svc.rpc("commit_decision", { p_decision_id: decisionId, p_user_id: userId, ...CHECKIN_DATES });
    expect(second.error).not.toBeNull();

    const { data: checkins } = await svc.from("checkins").select("id").eq("decision_id", decisionId);
    expect(checkins!.length).toBe(3);
  });

  it("rejects a non-owner call and leaves the decision a draft with no events/checkins", async () => {
    decisionId = await makeDraftDecision();

    const { error } = await svc.rpc("commit_decision", {
      p_decision_id: decisionId,
      p_user_id: "00000000-0000-0000-0000-000000000000",
      ...CHECKIN_DATES,
    });
    expect(error).not.toBeNull();

    const { data: decision } = await svc.from("decisions").select("status").eq("id", decisionId).single();
    expect(decision!.status).toBe("draft");

    const { data: events } = await svc.from("decision_events").select("id").eq("decision_id", decisionId);
    expect(events).toEqual([]);
    const { data: checkins } = await svc.from("checkins").select("id").eq("decision_id", decisionId);
    expect(checkins).toEqual([]);
  });
});
