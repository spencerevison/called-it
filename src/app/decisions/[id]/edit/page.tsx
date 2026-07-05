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

  // one pre-mortem slot per option (Flavor A, P10) — each slot can have multiple
  // premortems (each "regenerate" inserts a new row), only the latest per slot is live
  const optionSlots: { option: string; heading: string }[] =
    options.length >= 2
      ? options.map((option) => ({
          option,
          heading: `Pre-mortem — ${option}${option === decision.chosen_option ? " (chosen)" : ""}`,
        }))
      : [{ option: "", heading: "Pre-mortem" }]; // fewer than 2 options -> legacy whole-decision slot

  const premortemSlots = await Promise.all(
    optionSlots.map(async ({ option, heading }) => {
      const premortemQuery = supabase.from("premortems").select("id").eq("decision_id", decision.id);
      const { data: latestPremortem } = await (option
        ? premortemQuery.eq("option", option)
        : premortemQuery.is("option", null)
      )
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

      return { option: option || undefined, heading, premortemId: latestPremortem?.id ?? null, risks: risks ?? [] };
    }),
  );

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
      <div className="space-y-8">
        {premortemSlots.map((slot) => (
          <PremortemPanel
            key={slot.option ?? "legacy"}
            decisionId={decision.id}
            option={slot.option}
            heading={slot.heading}
            premortemId={slot.premortemId}
            risks={slot.risks as Risk[]}
            isDraft={true}
          />
        ))}
      </div>

      <CommitPanel decisionId={decision.id} />
    </main>
  );
}
