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
      />
    </main>
  );
}
