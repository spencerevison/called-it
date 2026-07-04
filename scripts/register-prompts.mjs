// T37 — register prompts/*.md into prompt_versions. Run manually (or wire
// into a deploy step later) rather than Next.js instrumentation.ts, since no
// such hook exists in this repo yet and adding one is out of scope here —
// logged in QUESTIONS.md. Mirrors seed.mjs's env-loading + service-role setup.
//
// The parse/drift logic itself lives in src/lib/prompts/registry.ts (unit
// tested); this script duplicates just enough of it in plain JS since
// scripts/ isn't run through a TS loader (same tradeoff seed.mjs already made).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

function parsePromptHeader(raw, filePath) {
  const systemIdx = raw.indexOf("---SYSTEM---");
  if (systemIdx === -1) throw new Error(`${filePath}: missing ---SYSTEM--- marker`);
  const header = raw.slice(0, systemIdx);

  const idMatch = header.match(/^#\s*(\S+)/m);
  if (!idMatch) throw new Error(`${filePath}: missing "# <id>" header line`);
  const kindMatch = header.match(/^kind:\s*(.+)$/m);
  if (!kindMatch) throw new Error(`${filePath}: missing "kind:" header line`);
  const notesMatch = header.match(/^notes:\s*(.+)$/m);

  return {
    id: idMatch[1].trim(),
    kind: kindMatch[1].trim(),
    filePath,
    contentHash: createHash("sha256").update(raw).digest("hex"),
    notes: notesMatch ? notesMatch[1].trim() : null,
  };
}

async function main() {
  const promptsDir = path.resolve(__dirname, "..", "prompts");
  const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
  const parsed = files.map((f) =>
    parsePromptHeader(readFileSync(path.join(promptsDir, f), "utf-8"), `prompts/${f}`),
  );

  const { data: existing, error } = await svc.from("prompt_versions").select("id, content_hash");
  if (error) throw error;
  const existingById = new Map((existing ?? []).map((row) => [row.id, row.content_hash]));

  const inserts = [];
  for (const prompt of parsed) {
    const registeredHash = existingById.get(prompt.id);
    if (registeredHash === undefined) {
      inserts.push(prompt);
      continue;
    }
    if (registeredHash !== prompt.contentHash) {
      throw new Error(
        `${prompt.filePath}: registered content_hash for "${prompt.id}" no longer matches the file on disk — ` +
          `bump the version suffix (e.g. _v2) instead of editing a registered prompt in place`,
      );
    }
  }

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
