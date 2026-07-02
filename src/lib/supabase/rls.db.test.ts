import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

// T11: RLS policy tests. Requires `supabase start` -- run via `pnpm test:db`,
// not part of `pnpm check` / CI (needs a live local Postgres + auth server).

let admin: SupabaseClient
let userA: SupabaseClient
let userB: SupabaseClient
let anon: SupabaseClient
let userAId: string
let userBId: string

const emailA = `rls-test-a-${randomUUID()}@example.com`
const emailB = `rls-test-b-${randomUUID()}@example.com`
const password = "password123!"

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

  anon = createClient(url, anonKey)
})

afterAll(async () => {
  // service role bypasses RLS -- clean up rows before deleting the users
  // that own them (no ON DELETE CASCADE on user_id FKs, see DATA_MODEL.md)
  await admin.from("decisions").delete().in("user_id", [userAId, userBId])
  await admin.from("prompt_versions").delete().eq("id", "rls_test_prompt")
  await admin.from("eval_items").delete().eq("id", "rls-test-item")
  await admin.auth.admin.deleteUser(userAId)
  await admin.auth.admin.deleteUser(userBId)
})

describe("decisions RLS", () => {
  it("lets a user read only their own rows", async () => {
    const { data: inserted, error: insertErr } = await userA
      .from("decisions")
      .insert({ user_id: userAId, title: "A's decision", context: "ctx" })
      .select()
      .single()
    expect(insertErr).toBeNull()
    expect(inserted).toBeTruthy()

    const { data: asOwner } = await userA.from("decisions").select().eq("id", inserted.id)
    expect(asOwner).toHaveLength(1)

    const { data: asOtherUser } = await userB.from("decisions").select().eq("id", inserted.id)
    expect(asOtherUser).toHaveLength(0)

    const { data: asAnon } = await anon.from("decisions").select().eq("id", inserted.id)
    expect(asAnon).toHaveLength(0)
  })

  it("rejects an authenticated insert with a mismatched user_id", async () => {
    const { error } = await userA
      .from("decisions")
      .insert({ user_id: userBId, title: "spoofed", context: "ctx" })
    expect(error).not.toBeNull()
  })

  it("anon reads zero rows across the table", async () => {
    const { data } = await anon.from("decisions").select()
    expect(data).toHaveLength(0)
  })
})

describe("prompt_versions RLS", () => {
  it("is readable by any authenticated user but not by anon", async () => {
    const { error: insertErr } = await admin
      .from("prompt_versions")
      .insert({ id: "rls_test_prompt", kind: "premortem", file_path: "prompts/x.md", content_hash: "abc" })
    expect(insertErr).toBeNull()

    const { data: asUser } = await userA.from("prompt_versions").select().eq("id", "rls_test_prompt")
    expect(asUser).toHaveLength(1)

    const { data: asAnon } = await anon.from("prompt_versions").select().eq("id", "rls_test_prompt")
    expect(asAnon).toHaveLength(0)
  })
})

describe("eval_items RLS", () => {
  it("is service-role only -- no policies grant authenticated or anon access", async () => {
    const { error: insertErr } = await admin
      .from("eval_items")
      .insert({ id: "rls-test-item", payload: {} })
    expect(insertErr).toBeNull()

    // no table grant at all for these roles -- the query itself is denied,
    // not just RLS-filtered to empty
    const { data: asUser, error: userErr } = await userA
      .from("eval_items")
      .select()
      .eq("id", "rls-test-item")
    expect(asUser ?? []).toHaveLength(0)
    expect(userErr).not.toBeNull()

    const { data: asAnon, error: anonErr } = await anon
      .from("eval_items")
      .select()
      .eq("id", "rls-test-item")
    expect(asAnon ?? []).toHaveLength(0)
    expect(anonErr).not.toBeNull()
  })
})
