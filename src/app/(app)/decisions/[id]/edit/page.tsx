import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DecisionForm } from "../../DecisionForm"
import { ForecastList } from "../../ForecastList"
import { PremortemPanel } from "../../PremortemPanel"

export default async function EditDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // RLS already scopes this to the caller's own rows -- no id belongs to a stranger
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status")
    .eq("id", id)
    .single()

  if (!decision || (decision.status !== "draft" && decision.status !== "active")) {
    notFound()
  }

  const { data: forecasts } = await supabase
    .from("forecasts")
    .select("id, question, probability, desired, resolve_by, resolved")
    .eq("decision_id", id)
    .order("created_at", { ascending: true })

  // most recent premortem only -- regenerate creates a new row, older ones fall out of view
  const { data: premortem } = await supabase
    .from("premortems")
    .select("id")
    .eq("decision_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: risks } = premortem
    ? await supabase
        .from("premortem_risks")
        .select("id, description, category, severity, source")
        .eq("premortem_id", premortem.id)
        .order("created_at", { ascending: true })
    : { data: [] }

  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-lg flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Edit decision</h1>
          {decision.status === "draft" ? (
            <DecisionForm
              decision={{
                id: decision.id,
                title: decision.title,
                context: decision.context,
                rationale: decision.rationale,
                options_considered: Array.isArray(decision.options_considered)
                  ? (decision.options_considered as string[])
                  : [],
                chosen_option: decision.chosen_option,
                stakes: decision.stakes,
                reversibility: decision.reversibility,
              }}
            />
          ) : (
            // active decisions freeze decision-time fields -- edits only via events (T28)
            <p className="text-sm text-muted-foreground">{decision.title}</p>
          )}
        </div>

        <ForecastList decisionId={id} forecasts={forecasts ?? []} />

        <PremortemPanel
          decisionId={id}
          status={decision.status}
          premortemId={premortem?.id ?? null}
          risks={risks ?? []}
        />
      </main>
    </div>
  )
}
