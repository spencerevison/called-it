import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "../StatusBadge"
import { CheckinTimeline } from "../CheckinTimeline"
import { DecisionEventsPanel, type DecisionEvent } from "../DecisionEventsPanel"

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: decision } = await supabase
    .from("decisions")
    .select(
      "id, title, context, rationale, options_considered, chosen_option, stakes, reversibility, status, decided_at, resolved_at",
    )
    .eq("id", id)
    .single()

  if (!decision) notFound()

  // drafts have nothing committed yet -- keep editing them on the edit page
  if (decision.status === "draft") notFound()

  const { data: forecasts } = await supabase
    .from("forecasts")
    .select("id, question, probability, desired, resolve_by, resolved, outcome")
    .eq("decision_id", id)
    .order("created_at", { ascending: true })

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

  const { data: checkinRows } = await supabase
    .from("checkins")
    .select("id, horizon, scheduled_for, status, completed_at, outcome_notes, overall_attribution")
    .eq("decision_id", id)
    .order("scheduled_for", { ascending: true })

  const checkinIds = (checkinRows ?? []).map((c) => c.id)
  const { data: failureRows } =
    checkinIds.length > 0
      ? await supabase
          .from("checkin_failures")
          .select("id, checkin_id, description, linked_risk_id, was_knowable, attribution")
          .in("checkin_id", checkinIds)
      : { data: [] }

  const checkins = (checkinRows ?? []).map((checkin) => ({
    ...checkin,
    failures: (failureRows ?? []).filter((f) => f.checkin_id === checkin.id),
  }))

  const { data: eventRows } = await supabase
    .from("decision_events")
    .select("id, event_type, payload, created_at")
    .eq("decision_id", id)
    .order("created_at", { ascending: true })

  const events = (eventRows ?? []) as DecisionEvent[]

  const options = Array.isArray(decision.options_considered) ? (decision.options_considered as string[]) : []

  return (
    <div className="flex flex-1 flex-col items-center bg-background text-foreground">
      <main className="flex w-full max-w-lg flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
            <StatusBadge status={decision.status} />
          </div>
          <p className="text-sm">{decision.context}</p>
          {decision.rationale ? <p className="text-sm text-muted-foreground">{decision.rationale}</p> : null}

          {options.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {options.map((option) => (
                <li key={option}>
                  {option === decision.chosen_option ? <span className="font-medium text-foreground">{option} (chosen)</span> : option}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-sm text-muted-foreground capitalize">
            {decision.stakes} stakes · {decision.reversibility.replace("_", " ")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Forecasts</h2>
          {!forecasts || forecasts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forecasts recorded.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {forecasts.map((forecast) => (
                <li key={forecast.id} className="flex flex-col gap-0.5 rounded-lg border border-input p-3">
                  <p className="text-sm font-medium">{forecast.question}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(forecast.probability * 100)}%
                    {forecast.desired ? " · desired" : ""}
                    {forecast.resolved ? ` · outcome: ${forecast.outcome ? "yes" : "no"}` : " · unresolved"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Pre-mortem</h2>
          {!risks || risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pre-mortem generated.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {risks.map((risk) => (
                <li key={risk.id} className="rounded-lg border border-input p-3 text-sm">
                  {risk.description}
                </li>
              ))}
            </ul>
          )}
        </div>

        <CheckinTimeline checkins={checkins} />

        <DecisionEventsPanel decisionId={id} events={events} active={decision.status === "active"} />

        {decision.status === "active" ? (
          <Link href={`/decisions/${id}/edit`} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
            Edit forecasts &amp; pre-mortem
          </Link>
        ) : null}
      </main>
    </div>
  )
}
