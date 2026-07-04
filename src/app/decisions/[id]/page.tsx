import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForecastTimeline } from "./forecast-timeline";
import { CheckinTimeline } from "./checkin-timeline";
import { PremortemPanel, type Risk } from "@/app/decisions/premortem-panel";
import { EventsPanel, type DecisionEvent } from "@/app/decisions/events-panel";
import { ResolvePanel } from "@/app/decisions/resolve-panel";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS (select-own) makes this both the fetch and the ownership check
  const { data: decision } = await supabase
    .from("decisions")
    .select(
      "id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status, decided_at, resolved_at",
    )
    .eq("id", id)
    .single();

  if (!decision) {
    notFound();
  }

  // drafts are still being built up — that flow lives on the edit page, not here
  if (decision.status === "draft") {
    redirect(`/decisions/${decision.id}/edit`);
  }

  const options = Array.isArray(decision.options_considered)
    ? decision.options_considered.map((option) => String(option))
    : [];

  const { data: forecasts } = await supabase
    .from("forecasts")
    .select("id, question, desired, resolve_by, resolved, probability, recalled_probability, outcome")
    .eq("decision_id", decision.id)
    .order("created_at", { ascending: true });

  // recorded probability never touches the DOM for an unresolved forecast (M3 integrity)
  const forecastRows = (forecasts ?? []).map((f) => ({
    ...f,
    probability: f.resolved ? f.probability : null,
  }));

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

  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, horizon, status, scheduled_for, completed_at")
    .eq("decision_id", decision.id)
    .order("scheduled_for", { ascending: true });

  const { data: events } = await supabase
    .from("decision_events")
    .select("id, event_type, payload, created_at")
    .eq("decision_id", decision.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-10">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{decision.title}</h1>
          <span className="text-xs text-muted-foreground">{decision.status}</span>
        </div>
        <p className="text-sm">{decision.context}</p>
        {decision.rationale ? (
          <p className="text-sm text-muted-foreground">{decision.rationale}</p>
        ) : null}
        <ul className="text-sm">
          {options.map((option) => (
            <li key={option} className={option === decision.chosen_option ? "font-medium" : ""}>
              {option === decision.chosen_option ? "✓ " : "· "}
              {option}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {decision.stakes} stakes · {decision.reversibility.replace("_", "-")}
          {decision.decided_at ? ` · decided ${new Date(decision.decided_at).toLocaleDateString()}` : ""}
          {decision.resolved_at ? ` · resolved ${new Date(decision.resolved_at).toLocaleDateString()}` : ""}
        </p>
      </div>

      <ForecastTimeline forecasts={forecastRows} />

      <PremortemPanel
        decisionId={decision.id}
        premortemId={latestPremortem?.id ?? null}
        risks={(risks ?? []) as Risk[]}
        isDraft={false}
      />

      <CheckinTimeline decisionId={decision.id} checkins={checkins ?? []} />

      <EventsPanel decisionId={decision.id} events={(events ?? []) as DecisionEvent[]} />

      {decision.status === "active" ? <ResolvePanel decisionId={decision.id} /> : null}
    </main>
  );
}
