// T37 — register prompts/*.md into prompt_versions. Run manually (or wire
// into a deploy step later) rather than Next.js instrumentation.ts, since no
// such hook exists in this repo yet and adding one is out of scope here —
// logged in QUESTIONS.md. Mirrors seed.mjs's env-loading + service-role setup.
//
// The parse/drift logic is the unit-tested src/lib/prompts/registry.ts — imported
// directly (Node 22.18+ strips the .ts types natively) so there's exactly one
// implementation and the tests cover the code this script actually runs.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, serviceClient } from "./lib/bootstrap.mjs";
import { parsePromptHeader, planPromptRegistration } from "../src/lib/prompts/registry.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvLocal();
const svc = serviceClient();

async function main() {
  const promptsDir = path.resolve(__dirname, "..", "prompts");
  const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
  const parsed = files.map((f) =>
    parsePromptHeader(readFileSync(path.join(promptsDir, f), "utf-8"), `prompts/${f}`),
  );

  const { data: existing, error } = await svc.from("prompt_versions").select("id, content_hash");
  if (error) throw error;

  // registry uses camelCase contentHash; the DB column is content_hash
  const inserts = planPromptRegistration(
    parsed,
    (existing ?? []).map((row) => ({ id: row.id, contentHash: row.content_hash })),
  );

  if (inserts.length === 0) {
    console.log("prompt_versions up to date, nothing to register.");
    return;
  }

  const { error: insertError } = await svc.from("prompt_versions").insert(
    inserts.map((p) => ({
      id: p.id,
      kind: p.kind,
      file_path: p.filePath,
      content_hash: p.contentHash,
      notes: p.notes,
    })),
  );
  if (insertError) throw insertError;
  console.log(`registered: ${inserts.map((p) => p.id).join(", ")}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
