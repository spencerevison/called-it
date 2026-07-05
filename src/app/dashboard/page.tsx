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

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Bias</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <BiasCard
            label="Hindsight"
            sufficient={metrics.hindsightBias.sufficient}
            insufficientNote={`Insufficient data — needs ${metrics.hindsightBias.minN}, have ${metrics.hindsightBias.n}.`}
            sentence={
              metrics.hindsightBias.sufficient
                ? `Your memory shifts ${metrics.hindsightBias.value!.toFixed(2)} points toward the outcome after the fact.`
                : undefined
            }
          />
          <BiasCard
            label="Optimism"
            sufficient={metrics.optimismBias.desired.sufficient}
            insufficientNote={`Insufficient data — needs ${metrics.optimismBias.desired.minN} desired forecasts, have ${metrics.optimismBias.desired.n}.`}
            sentence={
              metrics.optimismBias.desired.sufficient
                ? `You overestimate wanted outcomes by ${metrics.optimismBias.desired.value!.toFixed(2)} (control: ${metrics.optimismBias.control.value === null ? "—" : metrics.optimismBias.control.value.toFixed(2)}).`
                : undefined
            }
          />
          <BiasCard
            label="Self-serving"
            sufficient={metrics.selfServing.sufficient}
            insufficientNote={`Insufficient data — needs ${metrics.selfServing.minNPerSide} per side, have ${metrics.selfServing.goodN} good / ${metrics.selfServing.badN} bad.`}
            sentence={
              metrics.selfServing.sufficient
                ? `You credit skill for wins ${metrics.selfServing.value!.toFixed(2)} more often than for losses.`
                : undefined
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Behavior</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <BiasCard
            label="Granularity"
            sufficient={metrics.granularity.n > 0}
            insufficientNote="No forecasts yet."
            sentence={
              metrics.granularity.n > 0
                ? `${(metrics.granularity.round10Rate! * 100).toFixed(0)}% of your forecasts land on a round 10 (${(metrics.granularity.round5Rate! * 100).toFixed(0)}% within a round 5), ${(metrics.granularity.fiftyRate! * 100).toFixed(0)}% at exactly 50/50.`
                : undefined
            }
          />
          <BiasCard
            label="Horizon gap"
            sufficient={metrics.horizonGap.sufficient}
            insufficientNote={`Insufficient data — needs ${metrics.horizonGap.minNPerSide} per side, have ${metrics.horizonGap.shortN} short / ${metrics.horizonGap.longN} long.`}
            sentence={
              metrics.horizonGap.sufficient
                ? `Your long-horizon forecasts are ${metrics.horizonGap.value!.toFixed(2)} worse (Brier) than your short-horizon ones.`
                : undefined
            }
          />
          <BiasCard
            label="Options considered"
            sufficient={metrics.optionsConsidered.n > 0}
            insufficientNote="No committed decisions yet."
            sentence={
              metrics.optionsConsidered.n > 0
                ? `You consider ${metrics.optionsConsidered.value!.toFixed(1)} options on average before committing.`
                : undefined
            }
          />
          <BiasCard
            label="Reversal rate"
            sufficient={metrics.reversal.n > 0}
            insufficientNote="No committed decisions yet."
            sentence={
              metrics.reversal.n > 0
                ? `${(metrics.reversal.value! * 100).toFixed(0)}% of your committed decisions get reversed${
                    metrics.reversal.medianDaysToReversal !== null
                      ? `, typically within ${metrics.reversal.medianDaysToReversal.toFixed(0)} days`
                      : ""
                  }.`
                : undefined
            }
          />
          <BiasCard
            label="Pre-mortem surface rate"
            sufficient={metrics.premortemSurface.perFailure.n > 0}
            insufficientNote="No knowable failures yet."
            sentence={
              metrics.premortemSurface.perFailure.n > 0
                ? `Your pre-mortem flagged ${(metrics.premortemSurface.perFailure.value! * 100).toFixed(0)}% of knowable failures (at least one flagged in ${(metrics.premortemSurface.perDecision.value! * 100).toFixed(0)}% of those decisions).`
                : undefined
            }
          />
        </div>
      </section>
    </main>
  );
}

function BiasCard({
  label,
  sufficient,
  insufficientNote,
  sentence,
}: {
  label: string;
  sufficient: boolean;
  insufficientNote: string;
  sentence?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{sufficient ? sentence : insufficientNote}</p>
    </div>
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
