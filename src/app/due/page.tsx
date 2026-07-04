import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const HORIZON_LABELS: Record<string, string> = {
  two_weeks: "Two weeks",
  two_months: "Two months",
  six_months: "Six months",
  custom: "Custom",
};

export default async function DuePage() {
  const supabase = await createClient();
  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, horizon, scheduled_for, decision_id, decisions(title)")
    .eq("status", "due")
    .order("scheduled_for", { ascending: true });

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <h1 className="text-lg font-semibold">Due check-ins</h1>

      {!checkins || checkins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing due right now — check back after your next scheduled check-in.
        </p>
      ) : (
        <ul className="space-y-3">
          {checkins.map((c) => (
            <li key={c.id}>
              <Link
                href={`/decisions/${c.decision_id}/checkin/${c.id}`}
                className="flex items-center justify-between rounded-md border border-border p-3 hover:border-accent"
              >
                <span className="text-sm">{c.decisions?.title ?? "Untitled decision"}</span>
                <span className="text-xs text-muted-foreground">
                  {HORIZON_LABELS[c.horizon] ?? c.horizon} · scheduled{" "}
                  {new Date(c.scheduled_for).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
