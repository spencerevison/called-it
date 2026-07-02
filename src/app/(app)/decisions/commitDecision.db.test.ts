import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

// T26: commit_decision() RPC. Requires `supabase start` -- run via `pnpm test:db`,
// not part of `pnpm check` / CI. Exercises the real function to prove the
// transaction actually rolls back on partial failure, not just its shape.

let admin: SupabaseClient
let userA: SupabaseClient
let userB: SupabaseClient
let userAId: string
let userBId: string

const emailA = `commit-test-a-${randomUUID()}@example.com`
const emailB = `commit-test-b-${randomUUID()}@example.com`
const password = "password123!"

async function draftDecision(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("decisions")
    .insert({ user_id: userId, title: "test decision", context: "ctx" })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  admin = createClient(url, serviceKey)

  const { data: createdA, error: errA } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  })
  if (errA) throw errA
  userAId = createdA.user.id

  const { data: createdB, error: errB } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  })
  if (errB) throw errB
  userBId = createdB.user.id

  userA = createClient(url, anonKey)
  await userA.auth.signInWithPassword({ email: emailA, password })

  userB = createClient(url, anonKey)
  await userB.auth.signInWithPassword({ email: emailB, password })
})

afterAll(async () => {
  await admin.from("decisions").delete().in("user_id", [userAId, userBId])
  await admin.auth.admin.deleteUser(userAId)
  await admin.auth.admin.deleteUser(userBId)
})

describe("commit_decision", () => {
  it("flips draft to active, logs a committed event, and schedules 3 checkins", async () => {
    const id = await draftDecision(userA, userAId)

    const { data, error } = await userA.rpc("commit_decision", {
      p_decision_id: id,
      p_checkin_two_weeks: "2026-07-16T00:00:00Z",
      p_checkin_two_months: "2026-09-02T00:00:00Z",
      p_checkin_six_months: "2027-01-02T00:00:00Z",
    })
    expect(error).toBeNull()
    expect(data.status).toBe("active")
    expect(data.decided_at).toBeTruthy()

    const { data: events } = await admin.from("decision_events").select().eq("decision_id", id)
    expect(events).toHaveLength(1)
    expect(events![0].event_type).toBe("committed")

    const { data: checkins } = await admin.from("checkins").select().eq("decision_id", id).order("horizon")
    expect(checkins).toHaveLength(3)
    expect(checkins!.map((c) => c.horizon).sort()).toEqual(["six_months", "two_months", "two_weeks"])
    expect(checkins!.every((c) => c.status === "pending")).toBe(true)
  })

  it("leaves the draft untouched when a checkin insert fails partway through", async () => {
    const id = await draftDecision(userA, userAId)

    // scheduled_for is NOT NULL -- the third checkin insert fails, which must
    // roll back the status flip and event insert that already ran in this call
    const { error } = await userA.rpc("commit_decision", {
      p_decision_id: id,
      p_checkin_two_weeks: "2026-07-16T00:00:00Z",
      p_checkin_two_months: "2026-09-02T00:00:00Z",
      p_checkin_six_months: null,
    })
    expect(error).not.toBeNull()

    const { data: decision } = await admin.from("decisions").select().eq("id", id).single()
    expect(decision!.status).toBe("draft")
    expect(decision!.decided_at).toBeNull()

    const { data: events } = await admin.from("decision_events").select().eq("decision_id", id)
    expect(events).toHaveLength(0)

    const { data: checkins } = await admin.from("checkins").select().eq("decision_id", id)
    expect(checkins).toHaveLength(0)
  })

  it("rejects committing another user's decision", async () => {
    const id = await draftDecision(userA, userAId)

    const { error } = await userB.rpc("commit_decision", {
      p_decision_id: id,
      p_checkin_two_weeks: "2026-07-16T00:00:00Z",
      p_checkin_two_months: "2026-09-02T00:00:00Z",
      p_checkin_six_months: "2027-01-02T00:00:00Z",
    })
    expect(error).not.toBeNull()
  })

  it("rejects committing an already-active decision", async () => {
    const id = await draftDecision(userA, userAId)
    await userA.rpc("commit_decision", {
      p_decision_id: id,
      p_checkin_two_weeks: "2026-07-16T00:00:00Z",
      p_checkin_two_months: "2026-09-02T00:00:00Z",
      p_checkin_six_months: "2027-01-02T00:00:00Z",
    })

    const { error } = await userA.rpc("commit_decision", {
      p_decision_id: id,
      p_checkin_two_weeks: "2026-08-16T00:00:00Z",
      p_checkin_two_months: "2026-10-02T00:00:00Z",
      p_checkin_six_months: "2027-02-02T00:00:00Z",
    })
    expect(error).not.toBeNull()

    const { data: events } = await admin.from("decision_events").select().eq("decision_id", id)
    expect(events).toHaveLength(1)
  })
})
