// T41 — pnpm eval:judge --version <v>: outcome-blind judging of every eval_items
// row, agreement math against human_labels, disagreement detail to stdout +
// docs/eval/detail (gitignored), a content-free aggregate report committed to
// docs/eval/, and an eval_runs row. Mirrors eval-import.mjs's env/service-client
// setup and imports the unit-tested lib code directly (one impl, per T37/P6).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseGoldsetEntry } from "../src/lib/eval/goldset.ts";
import { assembleJudgeInputFromGoldset, findDisagreements, renderJudgeReport } from "../src/lib/eval/judge-run.ts";
import { computeAgreement } from "../src/lib/eval/agreement.ts";
import { hashJudgeInput, generateJudgeScores } from "../src/lib/llm/judge.ts";
import { hasAnthropicKey } from "../src/lib/llm/client.ts";
import { loadPromptTemplate, renderTemplate } from "../src/lib/prompts/template.ts";
import { startTrace } from "../src/lib/llm/tracing.ts";

const RUBRIC_VERSION = "v1"; // JUDGE_RUBRIC.md version, same constant as judge-actions.ts

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
  const idx = argv.indexOf("--version");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("usage: pnpm eval:judge --version <prompt_version>");
  }
  return { version: argv[idx + 1] };
}

async function main() {
  const { version } = parseArgs(process.argv.slice(2));

  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY not set — eval:judge makes live calls, refusing to run without a key.");
  }

  const { data: rows, error } = await svc.from("eval_items").select("id, payload").order("id");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("eval_items is empty — run pnpm eval:import first.");

  const entries = rows.map((row) => parseGoldsetEntry(JSON.stringify(row.payload), row.id));
  const template = await loadPromptTemplate(version);

  const judged = [];
  for (const entry of entries) {
    const input = assembleJudgeInputFromGoldset(entry);
    const inputHash = hashJudgeInput(input);
    const promptContext = { ...input, options_considered: input.options_considered.join(", ") };
    const system = renderTemplate(template.system, promptContext);
    const user = renderTemplate(template.user, promptContext);

    const trace = startTrace({
      name: "eval:judge",
      input: { itemId: entry.id, inputHash },
      promptVersion: version,
      rubricVersion: RUBRIC_VERSION,
    });

    const result = await generateJudgeScores({ model: template.model, system, user });
    trace.end(result.ok ? { scores: result.scores, contamination: result.contamination } : { error: result.error });

    if (!result.ok) throw new Error(`eval:judge: item ${entry.id} failed — ${result.error}`);

    judged.push({
      itemId: entry.id,
      human: entry.human_labels.judge_scores,
      humanRationale: entry.human_labels.score_rationales,
      judge: result.scores,
      judgeRationale: result.rationale,
    });
  }

  const agreement = computeAgreement(judged);
  const disagreements = findDisagreements(judged);

  console.log(`eval:judge ${version} — n=${judged.length}, macro within1=${agreement.macroWithin1.toFixed(2)}`);
  console.log(`${disagreements.length} disagreement case(s):`);
  for (const d of disagreements) {
    console.log(
      `  [${d.itemId}] ${d.dimension}: human=${d.humanScore} ("${d.humanRationale}") judge=${d.judgeScore} ("${d.judgeRationale}")`,
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const detailDir = path.resolve(__dirname, "..", "docs", "eval", "detail");
  mkdirSync(detailDir, { recursive: true });
  writeFileSync(path.join(detailDir, `${version}_${date}.json`), JSON.stringify(disagreements, null, 2));

  const reportDir = path.resolve(__dirname, "..", "docs", "eval");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${version}_${date}.md`);
  const reportRelPath = path.relative(path.resolve(__dirname, ".."), reportPath);
  writeFileSync(
    reportPath,
    renderJudgeReport({ version, date, itemIds: entries.map((e) => e.id), agreement }),
  );

  const { error: insertError } = await svc.from("eval_runs").insert({
    kind: "judge_agreement",
    prompt_versions: [version],
    metrics: agreement,
    report_path: reportRelPath,
  });
  if (insertError) throw insertError;

  console.log(`report written to ${reportRelPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
