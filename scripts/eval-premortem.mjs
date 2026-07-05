// T42 — pnpm eval:premortem --version <v>: generate a pre-mortem per goldset
// item from decision-time fields only, assisted-manual match generated risks
// against knowable failures + expected_premortem_risks, surface-rate report +
// eval_runs row. Mirrors eval-judge.mjs's env/service-client setup.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { loadEnvLocal, serviceClient } from "./lib/bootstrap.mjs";
import { parseGoldsetEntry } from "../src/lib/eval/goldset.ts";
import {
  buildPremortemPromptContext,
  buildMatchTargets,
  matchKey,
  computeSurfaceRate,
  computeExpectedCoverage,
  renderPremortemReport,
} from "../src/lib/eval/premortem-run.ts";
import { evalTraceTags } from "../src/lib/eval/judge-run.ts";
import { generatePremortemRisks } from "../src/lib/llm/premortem.ts";
import { hasAnthropicKey } from "../src/lib/llm/client.ts";
import { loadPromptTemplate, renderTemplate } from "../src/lib/prompts/template.ts";
import { startTrace } from "../src/lib/llm/tracing.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvLocal();
const svc = serviceClient();

function parseArgs(argv) {
  const idx = argv.indexOf("--version");
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error("usage: pnpm eval:premortem --version <prompt_version>");
  }
  return { version: argv[idx + 1] };
}

// matching session persists to a gitignored file (docs/eval/detail/ already
// gitignored per EVAL_PLAN privacy rule — matches quote risk/failure text)
function matchesPath(version) {
  return path.resolve(__dirname, "..", "docs", "eval", "detail", `premortem_matches_${version}.json`);
}

function loadMatches(version) {
  const p = matchesPath(version);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, "utf-8"));
}

function saveMatches(version, matches) {
  mkdirSync(path.dirname(matchesPath(version)), { recursive: true });
  writeFileSync(matchesPath(version), JSON.stringify(matches, null, 2));
}

async function promptMatch(rl, itemId, target, risks) {
  console.log(`\n[${itemId}] ${target.kind} #${target.index}: "${target.text}"`);
  risks.forEach((r, i) => console.log(`  ${i + 1}. ${r.description}`));
  const answer = await rl.question("  matched risk # (blank = no match): ");
  return answer.trim().length > 0;
}

async function main() {
  const { version } = parseArgs(process.argv.slice(2));

  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY not set — eval:premortem makes live calls, refusing to run without a key.");
  }

  const { data: rows, error } = await svc.from("eval_items").select("id, payload").order("id");
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error("eval_items is empty — run pnpm eval:import first.");

  const entries = rows.map((row) => parseGoldsetEntry(JSON.stringify(row.payload), row.id));
  const template = await loadPromptTemplate(version);
  const runId = randomUUID();
  const matches = loadMatches(version);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const results = [];
  let totalRisksGenerated = 0;

  try {
    for (const entry of entries) {
      const promptContext = buildPremortemPromptContext(entry);
      const system = renderTemplate(template.system, promptContext);
      const user = renderTemplate(template.user, { ...promptContext, options_considered: promptContext.options_considered.join(", ") });

      const trace = startTrace({
        name: "eval:premortem",
        input: { itemId: entry.id },
        promptVersion: version,
        tags: evalTraceTags(runId, version, entry.id),
      });

      const result = await generatePremortemRisks({ model: template.model, system, user });
      trace.end(result.ok ? { risks: result.risks } : { error: result.error });
      if (!result.ok) throw new Error(`eval:premortem: item ${entry.id} failed — ${result.error}`);

      totalRisksGenerated += result.risks.length;
      const targets = buildMatchTargets(entry);
      const targetResults = [];
      for (const target of targets) {
        const key = matchKey(entry.id, target, version);
        if (!(key in matches)) {
          matches[key] = await promptMatch(rl, entry.id, target, result.risks);
          saveMatches(version, matches);
        }
        targetResults.push({ target, matched: matches[key] });
      }
      results.push({ itemId: entry.id, risksGenerated: result.risks.length, targets: targetResults });
    }
  } finally {
    rl.close();
  }

  const surfaceRate = computeSurfaceRate(results);
  const expectedCoverage = computeExpectedCoverage(results);
  const meanRisksGenerated = totalRisksGenerated / results.length;

  console.log(
    `\neval:premortem ${version} — n=${results.length}, surface(per-failure)=${surfaceRate.perFailure ?? "n/a"}, surface(per-decision)=${surfaceRate.perDecision ?? "n/a"}`,
  );

  const date = new Date().toISOString().slice(0, 10);
  const reportDir = path.resolve(__dirname, "..", "docs", "eval");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${version}_premortem_${date}.md`);
  const reportRelPath = path.relative(path.resolve(__dirname, ".."), reportPath);
  writeFileSync(
    reportPath,
    renderPremortemReport({
      version,
      date,
      itemIds: entries.map((e) => e.id),
      surfaceRate,
      expectedCoverage,
      meanRisksGenerated,
    }),
  );

  const { error: insertError } = await svc.from("eval_runs").insert({
    id: runId,
    kind: "premortem_surface",
    prompt_versions: [version],
    metrics: { surfaceRate, expectedCoverage, meanRisksGenerated },
    report_path: reportRelPath,
  });
  if (insertError) throw insertError;

  console.log(`report written to ${reportRelPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
