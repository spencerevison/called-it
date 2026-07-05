import { createClient } from "@/lib/supabase/server";
import { createSupabaseMetricsFetcher } from "@/lib/metrics/supabase-fetcher";
import { getDashboardMetrics } from "@/lib/metrics/aggregate";
import { CalibrationChart, BrierTrendChart } from "./charts";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Sign in to see your dashboard.</p>
      </main>
    );
  }

  const [decisions, resolved, pending, due, metrics] = await Promise.all([
    supabase.from("decisions").select("id", { count: "exact", head: true }),
    supabase.from("decisions").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("checkins").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("checkins").select("id", { count: "exact", head: true }).eq("status", "due"),
    getDashboardMetrics(user.id, createSupabaseMetricsFetcher(supabase)),
  ]);
  const decisionCount = decisions.count ?? 0;
  const resolvedCount = resolved.count ?? 0;
  const openCheckins = (pending.count ?? 0) + (due.count ?? 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Decisions" value={decisionCount} />
        <SummaryCard label="Resolved" value={resolvedCount} />
        <SummaryCard label="Open check-ins" value={openCheckins} />
        <SummaryCard
          label="Brier score"
          value={metrics.brier.sufficient ? metrics.brier.value!.toFixed(3) : null}
          sentence={
            metrics.brier.sufficient
              ? "Lower is better — 0.25 is a coin flip, 0 is perfect."
              : `Insufficient data — needs ${metrics.brier.minN}, have ${metrics.brier.n}.`
          }
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Calibration</h2>
          <CalibrationChart bins={metrics.calibrationCurve} />
          <p className="text-xs text-muted-foreground">
            Dots on the diagonal mean your stated probabilities matched what actually happened. Greyed dots have
            fewer than 5 forecasts in that bin.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Brier trend</h2>
          {metrics.brierTrend.sufficient ? (
            <BrierTrendChart points={metrics.brierTrend.value!} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Insufficient data — needs {metrics.brierTrend.minN}, have {metrics.brierTrend.n}.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Rolling Brier score over a trailing 90-day window.</p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sentence,
}: {
  label: string;
  value: number | string | null;
  sentence?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl">{value === null ? "—" : value}</p>
      {sentence ? <p className="text-xs text-muted-foreground">{sentence}</p> : null}
    </div>
  );
}
