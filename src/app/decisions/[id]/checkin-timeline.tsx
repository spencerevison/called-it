import Link from "next/link";

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

export function CheckinTimeline({ decisionId, checkins }: { decisionId: string; checkins: Checkin[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Check-ins</h2>

      {checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No check-ins scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {checkins.map((c) => {
            const statusLabel =
              c.status === "completed" && c.completed_at
                ? `completed ${new Date(c.completed_at).toLocaleDateString()}`
                : `${c.status} · scheduled ${new Date(c.scheduled_for).toLocaleDateString()}`;
            const canWalk = c.status !== "completed" && c.status !== "skipped";

            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>{HORIZON_LABELS[c.horizon] ?? c.horizon}</span>
                {canWalk ? (
                  <Link href={`/decisions/${decisionId}/checkin/${c.id}`} className="text-xs text-accent">
                    {statusLabel}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">{statusLabel}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
