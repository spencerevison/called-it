import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecallForecasts } from "@/app/decisions/checkin-actions";
import { CheckinFlow } from "./checkin-flow";

export default async function CheckinFlowPage({
  params,
}: {
  params: Promise<{ id: string; checkinId: string }>;
}) {
  const { id, checkinId } = await params;
  const supabase = await createClient();

  // RLS (select-own) makes this both the fetch and the ownership check
  const { data: checkin } = await supabase
    .from("checkins")
    .select("id, decision_id, horizon, status, outcome_notes")
    .eq("id", checkinId)
    .single();

  if (!checkin || checkin.decision_id !== id) notFound();

  const { data: decision } = await supabase.from("decisions").select("title").eq("id", id).single();
  if (!decision) notFound();

  const result = await getRecallForecasts(checkinId);
  if (!result.ok) notFound();

  // same "most recent premortem" convention as the decision detail page (T25)
  const { data: latestPremortem } = await supabase
    .from("premortems")
    .select("id")
    .eq("decision_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: risks } = latestPremortem
    ? await supabase.from("premortem_risks").select("id, description").eq("premortem_id", latestPremortem.id)
    : { data: [] };

  const { data: failures } = await supabase
    .from("checkin_failures")
    .select("id, description, linked_risk_id, was_knowable, attribution")
    .eq("checkin_id", checkinId)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Check-in: {decision.title}</h1>
        <p className="text-xs text-muted-foreground">
          {checkin.status === "completed" ? "completed" : `status: ${checkin.status}`}
        </p>
      </div>

      <CheckinFlow
        checkinId={checkin.id}
        initialOutcomeNotes={checkin.outcome_notes ?? ""}
        forecasts={result.forecasts}
        risks={risks ?? []}
        initialFailures={failures ?? []}
        initialCompleted={checkin.status === "completed"}
      />
    </main>
  );
}
