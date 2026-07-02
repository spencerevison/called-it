"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { parseReviseInput, parseReverseInput, type ReviseFormErrors, type ReverseFormErrors } from "./eventsValidation"

export type ReviseFormState = { ok: false; errors: ReviseFormErrors } | null
export type ReverseFormState = { ok: false; errors: ReverseFormErrors } | null
export type ReaffirmFormState = { ok: false; error: string } | null

// only active decisions get events -- drafts have nothing committed yet, and
// resolved/abandoned decisions are done
async function requireActiveDecision(supabase: Awaited<ReturnType<typeof createClient>>, decisionId: string, userId: string) {
  const { data } = await supabase
    .from("decisions")
    .select("id")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  return data !== null
}

export async function reviseDecision(
  decisionId: string,
  _prev: ReviseFormState,
  formData: FormData,
): Promise<ReviseFormState> {
  const parsed = parseReviseInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  if (!(await requireActiveDecision(supabase, decisionId, user.id))) {
    return { ok: false, errors: { note: "Could not save. Try again." } }
  }

  const { error } = await supabase.from("decision_events").insert({
    user_id: user.id,
    decision_id: decisionId,
    event_type: "revised",
    payload: { note: parsed.value.note },
  })

  if (error) return { ok: false, errors: { note: "Could not save. Try again." } }

  redirect(`/decisions/${decisionId}`)
}

export async function reverseDecision(
  decisionId: string,
  _prev: ReverseFormState,
  formData: FormData,
): Promise<ReverseFormState> {
  const parsed = parseReverseInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  if (!(await requireActiveDecision(supabase, decisionId, user.id))) {
    return { ok: false, errors: { reason: "Could not save. Try again." } }
  }

  const { error } = await supabase.from("decision_events").insert({
    user_id: user.id,
    decision_id: decisionId,
    event_type: "reversed",
    payload: { reason: parsed.value.reason },
  })

  if (error) return { ok: false, errors: { reason: "Could not save. Try again." } }

  redirect(`/decisions/${decisionId}`)
}

export async function reaffirmDecision(decisionId: string, _prev: ReaffirmFormState): Promise<ReaffirmFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  if (!(await requireActiveDecision(supabase, decisionId, user.id))) {
    return { ok: false, error: "Could not save. Try again." }
  }

  const { error } = await supabase.from("decision_events").insert({
    user_id: user.id,
    decision_id: decisionId,
    event_type: "reaffirmed",
    payload: {},
  })

  if (error) return { ok: false, error: "Could not save. Try again." }

  redirect(`/decisions/${decisionId}`)
}
