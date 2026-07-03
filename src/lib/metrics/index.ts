// Pure metric functions, M1-M10. No DB access — see METRICS.md for definitions
// and normative test vectors. Aggregation service (T20) maps DB rows to these
// input shapes and owns min-n gating; these fns just compute + report n.

export type ForecastPO = { p: number; o: 0 | 1 };

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// M1 — Brier score
export function brier(forecasts: ForecastPO[]): { value: number | null; n: number } {
  const n = forecasts.length;
  if (n === 0) return { value: null, n: 0 };
  const value = mean(forecasts.map((f) => (f.p - f.o) ** 2));
  return { value, n };
}

// M2 — Calibration curve
export type CalibrationBin = {
  binStart: number;
  binEnd: number;
  n: number;
  meanPredicted: number;
  observedFrequency: number;
};

export function calibrationCurve(forecasts: ForecastPO[]): CalibrationBin[] {
  const buckets = new Map<number, ForecastPO[]>();
  for (const f of forecasts) {
    // last bin [0.9, 1.0] is right-closed; floor+clamp handles p=1.0 landing in bin 9
    const idx = Math.min(Math.floor(f.p * 10), 9);
    const bucket = buckets.get(idx) ?? [];
    bucket.push(f);
    buckets.set(idx, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idx, fs]) => ({
      binStart: idx / 10,
      binEnd: (idx + 1) / 10,
      n: fs.length,
      meanPredicted: mean(fs.map((f) => f.p))!,
      observedFrequency: mean(fs.map((f) => f.o))!,
    }));
}

// M3 — Hindsight bias coefficient
export type RecalledForecast = ForecastPO & { r: number };

export function hindsightBias(forecasts: RecalledForecast[]): { value: number | null; n: number } {
  const n = forecasts.length;
  if (n === 0) return { value: null, n: 0 };
  const drifts = forecasts.map((f) => (f.r - f.p) * (f.o === 1 ? 1 : -1));
  return { value: mean(drifts), n };
}

// M4 — Optimism bias coefficient
export type DesiredForecast = ForecastPO & { desired: boolean };

function optimismBiasOneSide(forecasts: ForecastPO[]): { value: number | null; n: number } {
  const n = forecasts.length;
  if (n === 0) return { value: null, n: 0 };
  const p = mean(forecasts.map((f) => f.p))!;
  const o = mean(forecasts.map((f) => f.o))!;
  return { value: p - o, n };
}

export function optimismBias(forecasts: DesiredForecast[]): {
  desired: { value: number | null; n: number };
  control: { value: number | null; n: number };
} {
  return {
    desired: optimismBiasOneSide(forecasts.filter((f) => f.desired)),
    control: optimismBiasOneSide(forecasts.filter((f) => !f.desired)),
  };
}

// M5 — Confidence granularity (round-number clustering)
export function confidenceGranularity(ps: number[]): {
  round10Rate: number | null;
  round5Rate: number | null;
  fiftyRate: number | null;
  n: number;
} {
  const n = ps.length;
  if (n === 0) return { round10Rate: null, round5Rate: null, fiftyRate: null, n: 0 };
  // basis points avoid float modulo weirdness (e.g. 0.7 % 0.1 !== 0 in fp)
  const bps = ps.map((p) => Math.round(p * 10000));
  const round10Rate = bps.filter((bp) => bp % 1000 === 0).length / n;
  const round5Rate = bps.filter((bp) => bp % 500 === 0).length / n;
  const fiftyRate = bps.filter((bp) => bp === 5000).length / n;
  return { round10Rate, round5Rate, fiftyRate, n };
}

// M6 — Horizon calibration gap
// Partitioning into short (<=30d) / long (>90d), excluding 31-90d, is the
// aggregation service's job (T20) — this fn just diffs two pre-split sets.
export function horizonCalibrationGap(
  short: ForecastPO[],
  long: ForecastPO[]
): { value: number | null; shortN: number; longN: number } {
  const shortBrier = brier(short);
  const longBrier = brier(long);
  const value =
    shortBrier.value === null || longBrier.value === null ? null : longBrier.value - shortBrier.value;
  return { value, shortN: shortBrier.n, longN: longBrier.n };
}

// M7 — Options-considered count
export function optionsConsideredCount(counts: number[]): { value: number | null; n: number } {
  return { value: mean(counts), n: counts.length };
}

// M8 — Reversal frequency
export type CommittedDecision = { reversed: boolean; daysToReversal?: number | null };

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function reversalRate(decisions: CommittedDecision[]): {
  value: number | null;
  n: number;
  medianDaysToReversal: number | null;
} {
  const n = decisions.length;
  if (n === 0) return { value: null, n: 0, medianDaysToReversal: null };
  const reversed = decisions.filter((d) => d.reversed);
  const value = reversed.length / n;
  const days = reversed.map((d) => d.daysToReversal).filter((d): d is number => d != null);
  return { value, n, medianDaysToReversal: median(days) };
}

// M9 — Luck/skill attribution pattern (self-serving index)
export type CheckinAttribution = { attribution: "skill" | "luck" | "mixed"; valence: "good" | "bad" };

function skillRate(checkins: CheckinAttribution[]): { value: number | null; n: number } {
  const n = checkins.length;
  if (n === 0) return { value: null, n: 0 };
  return { value: checkins.filter((c) => c.attribution === "skill").length / n, n };
}

export function selfServingIndex(checkins: CheckinAttribution[]): {
  value: number | null;
  goodN: number;
  badN: number;
} {
  const good = skillRate(checkins.filter((c) => c.valence === "good"));
  const bad = skillRate(checkins.filter((c) => c.valence === "bad"));
  const value = good.value === null || bad.value === null ? null : good.value - bad.value;
  return { value, goodN: good.n, badN: bad.n };
}

// M10 — Pre-mortem surface rate
export type KnowableFailure = { decisionId: string; linkedRiskId: string | null };

export function premortemSurfaceRate(failures: KnowableFailure[]): {
  perFailure: { value: number | null; n: number };
  perDecision: { value: number | null; n: number };
} {
  const n = failures.length;
  const perFailure =
    n === 0 ? { value: null, n: 0 } : { value: failures.filter((f) => f.linkedRiskId !== null).length / n, n };

  const byDecision = new Map<string, KnowableFailure[]>();
  for (const f of failures) {
    const bucket = byDecision.get(f.decisionId) ?? [];
    bucket.push(f);
    byDecision.set(f.decisionId, bucket);
  }
  const decisionCount = byDecision.size;
  const perDecision =
    decisionCount === 0
      ? { value: null, n: 0 }
      : {
          value: [...byDecision.values()].filter((fs) => fs.some((f) => f.linkedRiskId !== null)).length / decisionCount,
          n: decisionCount,
        };

  return { perFailure, perDecision };
}
