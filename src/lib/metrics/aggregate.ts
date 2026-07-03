// T20 — aggregation service. Maps DB rows (via an injected fetcher, so this
// stays pure/testable) into the M1-M10 input shapes from src/lib/metrics/index.ts,
// then applies the min-n gating rules from METRICS.md on top. Only the metrics
// where METRICS.md states an explicit min n are gated here; others pass through
// (the display layer handles calibration-bin greying etc itself).

import {
  brier,
  calibrationCurve,
  hindsightBias,
  optimismBias,
  confidenceGranularity,
  horizonCalibrationGap,
  optionsConsideredCount,
  reversalRate,
  selfServingIndex,
  premortemSurfaceRate,
  type ForecastPO,
  type CalibrationBin,
} from "./index";

export type DecisionRow = {
  id: string;
  decidedAt: string | null;
  optionsConsidered: string[];
};

export type DecisionEventRow = {
  decisionId: string;
  eventType: string;
  createdAt: string;
};

export type ForecastRow = {
  probability: number;
  outcome: boolean | null;
  resolved: boolean;
  desired: boolean;
  createdAt: string;
  resolvedAt: string | null;
  recalledProbability: number | null;
  resolvedInCheckinId: string | null;
};

export type CheckinRow = {
  id: string;
  overallAttribution: "skill" | "luck" | "mixed" | null;
};

export type KnowableFailureRow = {
  decisionId: string;
  linkedRiskId: string | null;
};

// thin data-access boundary — Supabase-backed impl lives in supabase-fetcher.ts,
// tests just pass an in-memory object matching this shape
export interface MetricsRowFetcher {
  getDecisions(userId: string): Promise<DecisionRow[]>;
  getDecisionEvents(userId: string): Promise<DecisionEventRow[]>;
  getForecasts(userId: string): Promise<ForecastRow[]>;
  // completed check-ins only (overall_attribution is required at completion)
  getCompletedCheckins(userId: string): Promise<CheckinRow[]>;
  // already filtered to: parent decision resolved AND was_knowable = true
  getKnowableFailures(userId: string): Promise<KnowableFailureRow[]>;
}

type Gated<T> = { value: T | null; n: number; minN: number; sufficient: boolean };

function gate<T>(value: T | null, n: number, minN: number): Gated<T> {
  const sufficient = n >= minN;
  return { value: sufficient ? value : null, n, minN, sufficient };
}

const DAY_MS = 86_400_000;

function toPO(f: ForecastRow): ForecastPO {
  return { p: f.probability, o: f.outcome ? 1 : 0 };
}

function checkinValence(checkinId: string, resolved: ForecastRow[]): "good" | "bad" {
  const linked = resolved.filter((f) => f.resolvedInCheckinId === checkinId);
  const goodCount = linked.filter((f) => (f.desired ? f.outcome === true : f.outcome === false)).length;
  // tie = bad (conservative, per METRICS.md M9)
  return goodCount > linked.length / 2 ? "good" : "bad";
}

export async function getDashboardMetrics(userId: string, fetcher: MetricsRowFetcher) {
  const [decisions, decisionEvents, forecasts, checkins, knowableFailures] = await Promise.all([
    fetcher.getDecisions(userId),
    fetcher.getDecisionEvents(userId),
    fetcher.getForecasts(userId),
    fetcher.getCompletedCheckins(userId),
    fetcher.getKnowableFailures(userId),
  ]);

  const resolved = forecasts.filter((f) => f.resolved);
  const resolvedPO = resolved.map(toPO);

  const briersResult = brier(resolvedPO);
  const calibration: CalibrationBin[] = calibrationCurve(resolvedPO);

  const hindsightInput = resolved
    .filter((f) => f.recalledProbability !== null)
    .map((f) => ({ p: f.probability, o: (f.outcome ? 1 : 0) as 0 | 1, r: f.recalledProbability! }));
  const hindsightResult = hindsightBias(hindsightInput);

  const optimismInput = resolved.map((f) => ({ p: f.probability, o: (f.outcome ? 1 : 0) as 0 | 1, desired: f.desired }));
  const optimismResult = optimismBias(optimismInput);

  const granularity = confidenceGranularity(forecasts.map((f) => f.probability));

  const shortForecasts: ForecastPO[] = [];
  const longForecasts: ForecastPO[] = [];
  for (const f of resolved) {
    if (!f.resolvedAt) continue;
    const days = (Date.parse(f.resolvedAt) - Date.parse(f.createdAt)) / DAY_MS;
    if (days <= 30) shortForecasts.push(toPO(f));
    else if (days > 90) longForecasts.push(toPO(f));
  }
  const horizonGapResult = horizonCalibrationGap(shortForecasts, longForecasts);

  const committed = decisions.filter((d) => d.decidedAt !== null);
  const optionsResult = optionsConsideredCount(committed.map((d) => d.optionsConsidered.length));

  const firstReversedAt = new Map<string, string>();
  for (const e of decisionEvents) {
    if (e.eventType !== "reversed") continue;
    if (!firstReversedAt.has(e.decisionId) || e.createdAt < firstReversedAt.get(e.decisionId)!) {
      firstReversedAt.set(e.decisionId, e.createdAt);
    }
  }
  const reversalInput = committed.map((d) => {
    const reversedAt = firstReversedAt.get(d.id);
    return {
      reversed: reversedAt !== undefined,
      daysToReversal: reversedAt ? (Date.parse(reversedAt) - Date.parse(d.decidedAt!)) / DAY_MS : null,
    };
  });
  const reversalResult = reversalRate(reversalInput);

  const selfServingInput = checkins
    .filter((c) => c.overallAttribution !== null)
    .map((c) => ({
      attribution: c.overallAttribution!,
      valence: checkinValence(c.id, resolved),
    }));
  const selfServingResult = selfServingIndex(selfServingInput);

  const surfaceRateResult = premortemSurfaceRate(
    knowableFailures.map((f) => ({ decisionId: f.decisionId, linkedRiskId: f.linkedRiskId }))
  );

  return {
    brier: gate(briersResult.value, briersResult.n, 5),
    calibrationCurve: calibration,
    hindsightBias: gate(hindsightResult.value, hindsightResult.n, 5),
    optimismBias: {
      desired: gate(optimismResult.desired.value, optimismResult.desired.n, 5),
      control: optimismResult.control,
    },
    granularity,
    horizonGap: {
      value: horizonGapResult.shortN >= 5 && horizonGapResult.longN >= 5 ? horizonGapResult.value : null,
      shortN: horizonGapResult.shortN,
      longN: horizonGapResult.longN,
      minNPerSide: 5,
      sufficient: horizonGapResult.shortN >= 5 && horizonGapResult.longN >= 5,
    },
    optionsConsidered: optionsResult,
    reversal: reversalResult,
    selfServing: {
      value: selfServingResult.goodN >= 4 && selfServingResult.badN >= 4 ? selfServingResult.value : null,
      goodN: selfServingResult.goodN,
      badN: selfServingResult.badN,
      minNPerSide: 4,
      sufficient: selfServingResult.goodN >= 4 && selfServingResult.badN >= 4,
    },
    premortemSurface: surfaceRateResult,
  };
}
