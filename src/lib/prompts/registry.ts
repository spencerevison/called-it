import { createHash } from "node:crypto";

// T37 — parse the frontmatter-ish header every prompts/*.md file starts with
// (see template.ts's ---SYSTEM---/---USER--- split) and turn it into a
// prompt_versions row. Kept separate from template.ts since this only needs
// the header, never the system/user bodies.

export type ParsedPrompt = {
  id: string;
  kind: string;
  filePath: string;
  contentHash: string;
  notes: string | null;
};

export type ExistingPromptVersion = {
  id: string;
  contentHash: string;
};

export class PromptDriftError extends Error {}

export function parsePromptHeader(raw: string, filePath: string): ParsedPrompt {
  const systemIdx = raw.indexOf("---SYSTEM---");
  if (systemIdx === -1) {
    throw new Error(`${filePath}: missing ---SYSTEM--- marker`);
  }
  const header = raw.slice(0, systemIdx);

  const idMatch = header.match(/^#\s*(\S+)/m);
  if (!idMatch) {
    throw new Error(`${filePath}: missing "# <id>" header line`);
  }
  const kindMatch = header.match(/^kind:\s*(.+)$/m);
  if (!kindMatch) {
    throw new Error(`${filePath}: missing "kind:" header line`);
  }
  const notesMatch = header.match(/^notes:\s*(.+)$/m);

  return {
    id: idMatch[1].trim(),
    kind: kindMatch[1].trim(),
    filePath,
    contentHash: createHash("sha256").update(raw).digest("hex"),
    notes: notesMatch ? notesMatch[1].trim() : null,
  };
}

// Diffs freshly-parsed prompt files against whatever's already registered.
// Unchanged files are skipped; new ids are queued for insert; a registered id
// whose on-disk hash no longer matches is drift — fail loudly rather than
// silently re-scoring against a prompt nobody reviewed.
export function planPromptRegistration(
  parsed: ParsedPrompt[],
  existing: ExistingPromptVersion[],
): ParsedPrompt[] {
  const existingById = new Map(existing.map((row) => [row.id, row.contentHash]));
  const inserts: ParsedPrompt[] = [];

  for (const prompt of parsed) {
    const registeredHash = existingById.get(prompt.id);
    if (registeredHash === undefined) {
      inserts.push(prompt);
      continue;
    }
    if (registeredHash !== prompt.contentHash) {
      throw new PromptDriftError(
        `${prompt.filePath}: registered content_hash for "${prompt.id}" no longer matches the file on disk — ` +
          `bump the version suffix (e.g. _v2) instead of editing a registered prompt in place`,
      );
    }
  }

  return inserts;
}
