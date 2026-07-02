"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { parseForecastInput, type ForecastFormErrors } from "./forecastValidation"

export type ForecastFormState = { ok: false; errors: ForecastFormErrors } | null

// forecasts only make sense while a decision is still being reasoned about
const EDITABLE_STATUSES = ["draft", "active"]

export async function createForecast(
  decisionId: string,
  _prev: ForecastFormState,
  formData: FormData,
): Promise<ForecastFormState> {
  const parsed = parseForecastInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: decision } = await supabase
    .from("decisions")
    .select("status")
    .eq("id", decisionId)
    .single()

  if (!decision || !EDITABLE_STATUSES.includes(decision.status)) {
    return { ok: false, errors: { question: "This decision no longer accepts new forecasts." } }
  }

  const { error } = await supabase.from("forecasts").insert({
    user_id: user.id,
    decision_id: decisionId,
    question: parsed.value.question,
    probability: parsed.value.probability,
    desired: parsed.value.desired,
    resolve_by: parsed.value.resolveBy,
  })

  if (error) {
    return { ok: false, errors: { question: "Could not save forecast. Try again." } }
  }

  revalidatePath(`/decisions/${decisionId}/edit`)
  return null
}

export async function updateForecast(
  decisionId: string,
  forecastId: string,
  _prev: ForecastFormState,
  formData: FormData,
): Promise<ForecastFormState> {
  const parsed = parseForecastInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase
    .from("forecasts")
    .update({
      question: parsed.value.question,
      probability: parsed.value.probability,
      desired: parsed.value.desired,
      resolve_by: parsed.value.resolveBy,
    })
    .eq("id", forecastId)
    .eq("user_id", user.id)
    .eq("resolved", false)

  if (error) {
    return { ok: false, errors: { question: "Could not save changes. Try again." } }
  }

  revalidatePath(`/decisions/${decisionId}/edit`)
  return null
}
