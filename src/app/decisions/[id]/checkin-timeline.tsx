type Checkin = {
  id: string;
  horizon: string;
  status: string;
  scheduled_for: string;
  completed_at: string | null;
};

const HORIZON_LABELS: Record<string, string> = {
  two_weeks: "Two weeks",
  two_months: "Two months",
  six_months: "Six months",
  custom: "Custom",
};

export function CheckinTimeline({ checkins }: { checkins: Checkin[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Check-ins</h2>

      {checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {checkins.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
            >
              <span>{HORIZON_LABELS[c.horizon] ?? c.horizon}</span>
              <span className="text-xs text-muted-foreground">
                {c.status === "completed" && c.completed_at
                  ? `completed ${new Date(c.completed_at).toLocaleDateString()}`
                  : `${c.status} · scheduled ${new Date(c.scheduled_for).toLocaleDateString()}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
