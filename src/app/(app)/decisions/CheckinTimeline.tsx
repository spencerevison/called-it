const HORIZON_LABEL: Record<string, string> = {
  two_weeks: "2 weeks",
  two_months: "2 months",
  six_months: "6 months",
  custom: "Custom",
}

const CHECKIN_STATUS_CLASS: Record<string, string> = {
  pending: "border-muted-foreground text-muted-foreground",
  due: "border-caution text-caution",
  completed: "border-positive text-positive",
  skipped: "border-muted-foreground text-muted-foreground",
}

type Failure = {
  id: string
  description: string
  linked_risk_id: string | null
  was_knowable: boolean
  attribution: "skill" | "luck" | "mixed"
}

type Checkin = {
  id: string
  horizon: string
  scheduled_for: string
  status: "pending" | "due" | "completed" | "skipped"
  completed_at: string | null
  outcome_notes: string | null
  overall_attribution: "skill" | "luck" | "mixed" | null
  failures: Failure[]
}

export function CheckinTimeline({ checkins }: { checkins: Checkin[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Check-ins</h2>

      {checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins scheduled yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {checkins.map((checkin) => (
            <li key={checkin.id} className="flex flex-col gap-2 rounded-lg border border-input p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {HORIZON_LABEL[checkin.horizon] ?? checkin.horizon} · {checkin.scheduled_for}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${CHECKIN_STATUS_CLASS[checkin.status] ?? "border-input text-muted-foreground"}`}
                >
                  {checkin.status}
                </span>
              </div>

              {checkin.status === "completed" ? (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {checkin.outcome_notes ? <p>{checkin.outcome_notes}</p> : null}
                  {checkin.overall_attribution ? <p>Overall attribution: {checkin.overall_attribution}</p> : null}
                  {checkin.failures.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {checkin.failures.map((failure) => (
                        <li key={failure.id}>
                          {failure.description} — {failure.linked_risk_id ? "linked risk" : "unlisted"},{" "}
                          {failure.was_knowable ? "knowable" : "not knowable"}, {failure.attribution}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
