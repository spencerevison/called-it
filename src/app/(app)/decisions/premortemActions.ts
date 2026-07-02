"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { generatePremortemRisks } from "@/lib/premortem/generate"
import { PREMORTEM_PROMPT_VERSION } from "@/lib/premortem/prompt"
import { callAnthropic, ANTHROPIC_MODEL } from "@/lib/llm/anthropic"
import { getLangfuseClient } from "@/lib/langfuse/client"
import { parseRiskInput, type RiskFormErrors } from "./riskValidation"

export type PremortemActionState = { ok: false; error: string } | null
export type RiskActionState = { ok: false; errors: RiskFormErrors } | null

export async function generatePremortem(decisionId: string): Promise<PremortemActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: decision } = await supabase
    .from("decisions")
    .select("title, context, rationale, options_considered, chosen_option, stakes, reversibility, status")
    .eq("id", decisionId)
    .eq("user_id", user.id)
    .single()

  // regenerate allowed on draft only (T25) -- generation itself only ever makes sense pre-commit
  if (!decision || decision.status !== "draft") {
    return { ok: false, error: "Pre-mortem can only be generated on a draft decision." }
  }

  const { data: forecasts } = await supabase
    .from("forecasts")
    .select("question, probability, desired")
    .eq("decision_id", decisionId)

  const langfuse = getLangfuseClient()
  const trace = langfuse?.trace({
    name: PREMORTEM_PROMPT_VERSION,
    userId: user.id,
    metadata: { decisionId },
  })

  let risks
  try {
    risks = await generatePremortemRisks(
      {
        decision: {
          title: decision.title,
          context: decision.context,
          rationale: decision.rationale,
          optionsConsidered: (decision.options_considered as string[] | null) ?? [],
          chosenOption: decision.chosen_option,
          stakes: decision.stakes,
          reversibility: decision.reversibility,
        },
        forecasts: forecasts ?? [],
      },
      callAnthropic,
    )
  } catch (err) {
    trace?.update({ output: { error: err instanceof Error ? err.message : String(err) } })
    await langfuse?.flushAsync()
    return { ok: false, error: "Pre-mortem generation failed. Try again." }
  }

  trace?.update({ output: { risks } })
  await langfuse?.flushAsync()

  const { data: premortem, error: premortemError } = await supabase
    .from("premortems")
    .insert({
      user_id: user.id,
      decision_id: decisionId,
      prompt_version: PREMORTEM_PROMPT_VERSION,
      model: ANTHROPIC_MODEL,
      langfuse_trace_id: trace?.id ?? null,
    })
    .select("id")
    .single()

  if (premortemError || !premortem) {
    return { ok: false, error: "Could not save pre-mortem. Try again." }
  }

  const { error: risksError } = await supabase.from("premortem_risks").insert(
    risks.map((risk) => ({
      user_id: user.id,
      premortem_id: premortem.id,
      description: risk.description,
      category: risk.category,
      severity: risk.severity,
      likelihood: risk.likelihood,
      source: "ai" as const,
    })),
  )

  if (risksError) {
    return { ok: false, error: "Could not save pre-mortem risks. Try again." }
  }

  revalidatePath(`/decisions/${decisionId}/edit`)
  return null
}

// user's own risk, attached to an existing premortem -- source=user distinguishes it in the UI
export async function addUserRisk(
  decisionId: string,
  premortemId: string,
  _prev: RiskActionState,
  formData: FormData,
): Promise<RiskActionState> {
  const parsed = parseRiskInput(formData)
  if (!parsed.ok) return { ok: false, errors: parsed.errors }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.from("premortem_risks").insert({
    user_id: user.id,
    premortem_id: premortemId,
    description: parsed.value.description,
    category: parsed.value.category,
    severity: parsed.value.severity,
    source: "user" as const,
  })

  if (error) {
    return { ok: false, errors: { description: "Could not save risk. Try again." } }
  }

  revalidatePath(`/decisions/${decisionId}/edit`)
  return null
}
