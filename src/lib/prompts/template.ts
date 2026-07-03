import { readFile } from "node:fs/promises";
import path from "node:path";

export type PromptTemplate = {
  model: string;
  system: string;
  user: string;
};

// small mustache-lite renderer — just enough for the sections our prompt
// files actually use: {{var}}, {{#list}}...{{/list}}, {{#flag}}...{{/flag}}
// single pass over sections AND variables, so a substituted value that itself
// contains "{{...}}" (e.g. a user's forecast question) is never rescanned as a directive
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(
    /{{#(\w+)}}([\s\S]*?){{\/\1}}|{{(\w+)}}/g,
    (_match, sectionKey: string | undefined, inner: string | undefined, varKey: string | undefined) => {
      if (sectionKey !== undefined) {
        const value = context[sectionKey];
        if (Array.isArray(value)) {
          return value.map((item) => renderTemplate(inner ?? "", item as Record<string, unknown>)).join("");
        }
        return value ? renderTemplate(inner ?? "", context) : "";
      }
      const value = context[varKey as string];
      return value === undefined || value === null ? "" : String(value);
    },
  );
}

export async function loadPromptTemplate(name: string): Promise<PromptTemplate> {
  const filePath = path.join(process.cwd(), "prompts", `${name}.md`);
  const raw = await readFile(filePath, "utf-8");

  const systemIdx = raw.indexOf("---SYSTEM---");
  const userIdx = raw.indexOf("---USER---");
  if (systemIdx === -1 || userIdx === -1) {
    throw new Error(`Prompt file ${name}.md is missing a ---SYSTEM--- or ---USER--- marker.`);
  }

  const header = raw.slice(0, systemIdx);
  const modelMatch = header.match(/^model:\s*(.+)$/m);
  if (!modelMatch) {
    throw new Error(`Prompt file ${name}.md is missing a "model:" header line.`);
  }

  return {
    model: modelMatch[1].trim(),
    system: raw.slice(systemIdx + "---SYSTEM---".length, userIdx).trim(),
    user: raw.slice(userIdx + "---USER---".length).trim(),
  };
}
