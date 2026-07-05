// T45 [DEFER] — pnpm eval:contamination: judges every eval_items row twice,
// once with judge_v1 (blind) and once with judge_v1_aware (outcome-aware,
// registry-excluded, T45), then reports the mean score delta by dimension
// split by outcome valence (EVAL_PLAN's contamination-susceptibility row).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadEnvLocal, serviceClient } from "./lib/bootstrap.mjs";
import { parseGoldsetEntry } from "../src/lib/eval/goldset.ts";
import { computeContaminationDelta, judgeContaminationPair, renderContaminationReport } from "../src/lib/eval/contamination.ts";
import { generateJudgeScores } from "../src/lib/llm/judge.ts";
import { hasAnthropicKey } from "../src/lib/llm/client.ts";
import { loadPromptTemplate } from "../src/lib/prompts/template.ts";

const AWARE_TEMPLATE_NAME = "judge_v1_aware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvLocal();
const svc = serviceClient();

function parseArgs(argv) {
  const idx = argv.indexOf("--version");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("usage: pnpm eval:contamination --version <blind_prompt_version>");
  }
  return { version: argv[idx + 1] };
}

async function main() {
  const { version } = parseArgs(process.argv.slice(2));

  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY not set — eval:contamination makes live calls, refusing to run without a key.");
  }

  const { data: rows, error } = await svc.from("eval_items").select("id, payload").order("id");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("eval_items is empty — run pnpm eval:import first.");

  const entries = rows.map((row) => parseGoldsetEntry(JSON.stringify(row.payload), row.id));
  const blindTemplate = await loadPromptTemplate(version);
  const awareTemplate = await loadPromptTemplate(AWARE_TEMPLATE_NAME);
  const runId = randomUUID();

  const items = await judgeContaminationPair({
    entries,
    blindTemplate,
    awareTemplate,
    version,
    runId,
    scoreFn: generateJudgeScores,
  });

  const delta = computeContaminationDelta(items);
  console.log(
    `eval:contamination ${version} — n=${items.length} (good=${delta.goodN}, bad=${delta.badN})`,
  );

  const date = new Date().toISOString().slice(0, 10);
  const reportDir = path.resolve(__dirname, "..", "docs", "eval");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${version}_contamination_${date}.md`);
  const reportRelPath = path.relative(path.resolve(__dirname, ".."), reportPath);
  const report = renderContaminationReport({ version, date, itemIds: entries.map((e) => e.id), delta });
  writeFileSync(reportPath, report);
  console.log(report);

  const { error: insertError } = await svc.from("eval_runs").insert({
    id: runId,
    kind: "contamination",
    prompt_versions: [version, AWARE_TEMPLATE_NAME],
    metrics: delta,
    report_path: reportRelPath,
  });
  if (insertError) throw insertError;

  console.log(`report written to ${reportRelPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
