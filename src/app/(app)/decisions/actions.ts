"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { parseDecisionInput, type DecisionFormErrors } from "./validation"

export type DecisionFormState = { ok: false; errors: DecisionFormErrors } | null

export async function createDecision(
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const parsed = parseDecisionInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      user_id: user.id,
      title: parsed.value.title,
      context: parsed.value.context,
      rationale: parsed.value.rationale,
      options_considered: parsed.value.options,
      chosen_option: parsed.value.chosenOption,
      stakes: parsed.value.stakes,
      reversibility: parsed.value.reversibility,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, errors: { title: "Could not save draft. Try again." } }
  }

  redirect(`/decisions/${data.id}/edit`)
}

export async function updateDecision(
  id: string,
  _prev: DecisionFormState,
  formData: FormData,
): Promise<DecisionFormState> {
  const parsed = parseDecisionInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // status='draft' guard -- committed decisions are edited only via events (T26/T28)
  const { error } = await supabase
    .from("decisions")
    .update({
      title: parsed.value.title,
      context: parsed.value.context,
      rationale: parsed.value.rationale,
      options_considered: parsed.value.options,
      chosen_option: parsed.value.chosenOption,
      stakes: parsed.value.stakes,
      reversibility: parsed.value.reversibility,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "draft")

  if (error) {
    return { ok: false, errors: { title: "Could not save changes. Try again." } }
  }

  redirect(`/decisions/${id}/edit`)
}
