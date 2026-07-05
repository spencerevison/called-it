// T43 — pnpm eval:compare --kind premortem v1 v2: delta table across two
// eval_runs rows (surface rate, mean risks generated) plus per-run cost/latency
// pulled from Langfuse traces tagged with the run's id (EVAL_PLAN §2 tag contract).

export type VersionRunStats = {
  version: string;
  surfaceRatePerFailure: number | null;
  surfaceRatePerDecision: number | null;
  meanRisksGenerated: number;
  costPerItem: number | null;
  p50LatencyMs: number | null;
};

// median, not mean — a single slow/expensive item shouldn't dominate the headline number
export function computeCostLatencyStats(traces: { totalCost: number; latency: number }[]): {
  costPerItem: number | null;
  p50LatencyMs: number | null;
} {
  if (traces.length === 0) return { costPerItem: null, p50LatencyMs: null };

  const meanCost = traces.reduce((sum, t) => sum + t.totalCost, 0) / traces.length;

  const sortedLatencies = [...traces.map((t) => t.latency)].sort((a, b) => a - b);
  const mid = Math.floor(sortedLatencies.length / 2);
  const medianLatencySeconds =
    sortedLatencies.length % 2 === 0 ? (sortedLatencies[mid - 1] + sortedLatencies[mid]) / 2 : sortedLatencies[mid];

  return { costPerItem: meanCost, p50LatencyMs: medianLatencySeconds * 1000 };
}

type DeltaRow = { metric: string; a: string; b: string; delta: string };

function fmt(n: number | null, digits = 3): string {
  return n === null ? "n/a" : n.toFixed(digits);
}

function delta(a: number | null, b: number | null, digits = 3): string {
  if (a === null || b === null) return "n/a";
  const d = b - a;
  return `${d >= 0 ? "+" : ""}${d.toFixed(digits)}`;
}

export function computeDeltaRows(a: VersionRunStats, b: VersionRunStats): DeltaRow[] {
  return [
    { metric: "surface rate (per-failure)", a: fmt(a.surfaceRatePerFailure), b: fmt(b.surfaceRatePerFailure), delta: delta(a.surfaceRatePerFailure, b.surfaceRatePerFailure) },
    { metric: "surface rate (per-decision)", a: fmt(a.surfaceRatePerDecision), b: fmt(b.surfaceRatePerDecision), delta: delta(a.surfaceRatePerDecision, b.surfaceRatePerDecision) },
    { metric: "mean risks generated / item", a: a.meanRisksGenerated.toFixed(2), b: b.meanRisksGenerated.toFixed(2), delta: delta(a.meanRisksGenerated, b.meanRisksGenerated, 2) },
    { metric: "cost / item (USD)", a: fmt(a.costPerItem, 4), b: fmt(b.costPerItem, 4), delta: delta(a.costPerItem, b.costPerItem, 4) },
    { metric: "p50 latency (ms)", a: fmt(a.p50LatencyMs, 0), b: fmt(b.p50LatencyMs, 0), delta: delta(a.p50LatencyMs, b.p50LatencyMs, 0) },
  ];
}

// Committed report: aggregate metrics only, no item ids/content quoted from
// either run (EVAL_PLAN privacy rule).
export function renderCompareReport(params: { kind: string; date: string; a: VersionRunStats; b: VersionRunStats }): string {
  const { kind, date, a, b } = params;
  const rows = computeDeltaRows(a, b);
  const table = rows.map((r) => `| ${r.metric} | ${r.a} | ${r.b} | ${r.delta} |`).join("\n");

  return `# ${kind} compare — ${a.version} vs ${b.version} (${date})

| metric | ${a.version} | ${b.version} | delta |
|---|---|---|---|
${table}
`;
}
