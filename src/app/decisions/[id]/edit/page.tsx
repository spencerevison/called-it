import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "@/app/decisions/decision-form";
import { ForecastList } from "@/app/decisions/forecast-list";
import { PremortemPanel, type Risk } from "@/app/decisions/premortem-panel";
import { CommitPanel } from "@/app/decisions/commit-panel";

export default async function EditDecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS (select-own) makes this both the fetch and the ownership check
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status")
    .eq("id", id)
    .single();

  if (!decision || decision.status !== "draft") {
    notFound();
  }

  const options = Array.isArray(decision.options_considered)
    ? decision.options_considered.map((option) => String(option))
    : [];

  const { data: forecasts } = await supabase
    .from("forecasts")
    .select("id, question, probability, desired, resolve_by")
    .eq("decision_id", decision.id)
    .order("created_at", { ascending: true });

  // a decision can have multiple premortems (each "regenerate" inserts a new row) —
  // only the most recent one is live; older rows are inert history
  const { data: latestPremortem } = await supabase
    .from("premortems")
    .select("id")
    .eq("decision_id", decision.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: risks } = latestPremortem
    ? await supabase
        .from("premortem_risks")
        .select("id, description, category, severity, source")
        .eq("premortem_id", latestPremortem.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-10">
      <div>
        <h1 className="mb-6 text-lg font-semibold">Edit decision</h1>
        <DecisionForm
          mode="edit"
          decisionId={decision.id}
          initial={{
            title: decision.title,
            context: decision.context,
            rationale: decision.rationale,
            options,
            chosenOption: decision.chosen_option,
            stakes: decision.stakes,
            reversibility: decision.reversibility,
          }}
        />
      </div>

      <ForecastList decisionId={decision.id} forecasts={forecasts ?? []} />

      {/* this page only renders for status === "draft" (see notFound above) */}
      <PremortemPanel
        decisionId={decision.id}
        premortemId={latestPremortem?.id ?? null}
        risks={(risks ?? []) as Risk[]}
        isDraft={true}
      />

      <CommitPanel decisionId={decision.id} />
    </main>
  );
}
