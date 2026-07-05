// T43 — pnpm eval:compare --kind premortem v1 v2: pulls the latest eval_runs
// row per version (already produced by pnpm eval:premortem), plus cost/latency
// from Langfuse traces tagged run_id:<run.id> (EVAL_PLAN §2 tag contract),
// renders a delta table, writes a content-free report + an eval_runs row.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Langfuse } from "langfuse";
import { computeCostLatencyStats, renderCompareReport } from "../src/lib/eval/compare-run.ts";

// kind flag -> eval_runs.kind produced by that run's CLI (only premortem exists so far)
const KIND_TO_RUN_KIND = { premortem: "premortem_surface" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([\w.-]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function parseArgs(argv) {
  const idx = argv.indexOf("--kind");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("usage: pnpm eval:compare --kind premortem <v1> <v2>");
  }
  const kind = argv[idx + 1];
  const versions = argv.filter((_, i) => i !== idx && i !== idx + 1);
  if (versions.length !== 2) {
    throw new Error("usage: pnpm eval:compare --kind premortem <v1> <v2>");
  }
  if (!(kind in KIND_TO_RUN_KIND)) {
    throw new Error(`unsupported --kind "${kind}" — only "premortem" is wired up`);
  }
  return { kind, runKind: KIND_TO_RUN_KIND[kind], versions };
}

async function latestRun(runKind, version) {
  const { data, error } = await svc
    .from("eval_runs")
    .select("id, metrics, prompt_versions")
    .eq("kind", runKind)
    .contains("prompt_versions", [version])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`no ${runKind} eval_runs row for version "${version}" — run pnpm eval:premortem --version ${version} first.`);
  return data[0];
}

async function versionStats(langfuse, runKind, version) {
  const run = await latestRun(runKind, version);
  const traces = langfuse ? (await langfuse.api.traceList({ tags: [`run_id:${run.id}`], limit: 100 })).data : [];
  const { costPerItem, p50LatencyMs } = computeCostLatencyStats(traces.map((t) => ({ totalCost: t.totalCost, latency: t.latency })));

  return {
    version,
    surfaceRatePerFailure: run.metrics.surfaceRate?.perFailure ?? null,
    surfaceRatePerDecision: run.metrics.surfaceRate?.perDecision ?? null,
    meanRisksGenerated: run.metrics.meanRisksGenerated,
    costPerItem,
    p50LatencyMs,
  };
}

async function main() {
  const { kind, runKind, versions } = parseArgs(process.argv.slice(2));
  const [v1, v2] = versions;

  const langfuse =
    process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY
      ? new Langfuse({
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          baseUrl: process.env.LANGFUSE_BASE_URL,
        })
      : null;

  const a = await versionStats(langfuse, runKind, v1);
  const b = await versionStats(langfuse, runKind, v2);

  const date = new Date().toISOString().slice(0, 10);
  const report = renderCompareReport({ kind, date, a, b });
  console.log(`\n${report}`);

  const reportDir = path.resolve(__dirname, "..", "docs", "eval");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${kind}_compare_${v1}_vs_${v2}_${date}.md`);
  const reportRelPath = path.relative(path.resolve(__dirname, ".."), reportPath);
  writeFileSync(reportPath, report);

  const { error: insertError } = await svc.from("eval_runs").insert({
    kind: "compare",
    prompt_versions: [v1, v2],
    metrics: { a, b },
    report_path: reportRelPath,
  });
  if (insertError) throw insertError;

  console.log(`report written to ${reportRelPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
