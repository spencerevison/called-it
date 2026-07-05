// T40 — pnpm eval:import: validate goldset/*.json and load into eval_items.
// Mirrors register-prompts.mjs's env-loading + service-role setup, and
// imports the unit-tested src/lib/eval/goldset.ts directly (one impl).

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, serviceClient } from "./lib/bootstrap.mjs";
import { parseGoldsetEntry } from "../src/lib/eval/goldset.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvLocal();
const svc = serviceClient();

async function main() {
  const goldsetDir = path.resolve(__dirname, "..", "goldset");
  // top-level *.json only — goldset/fixtures/ is T44's CI-smoke fixture set, not a live import.
  const files = readdirSync(goldsetDir).filter(
    (f) => f.endsWith(".json") && statSync(path.join(goldsetDir, f)).isFile(),
  );

  const entries = [];
  const errors = [];
  for (const file of files) {
    try {
      const raw = readFileSync(path.join(goldsetDir, file), "utf-8");
      entries.push(parseGoldsetEntry(raw, file));
    } catch (err) {
      errors.push(err.message ?? String(err));
    }
  }

  if (errors.length > 0) {
    console.error(`${errors.length} file(s) failed validation:`);
    for (const msg of errors) console.error(`  ${msg}`);
    process.exit(1);
  }

  const { error } = await svc
    .from("eval_items")
    .upsert(entries.map((e) => ({ id: e.id, payload: e })));
  if (error) throw error;

  console.log(`imported ${entries.length} gold-set item(s): ${entries.map((e) => e.id).join(", ")}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
