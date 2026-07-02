import { readFileSync } from "node:fs"
import path from "node:path"

export type ParsedPrompt = {
  frontmatter: Record<string, string>
  system: string
  user: string
}

export function loadPromptFile(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf-8")
}

// prompts/*.md shape: "# name\n\nkey: value\n...\n\n---SYSTEM---\n<system>\n\n---USER---\n<user>"
export function parsePromptFile(raw: string): ParsedPrompt {
  const [header, afterSystem] = raw.split(/\r?\n---SYSTEM---\r?\n/)
  if (afterSystem === undefined) {
    throw new Error("Prompt file missing ---SYSTEM--- marker")
  }
  const [system, user] = afterSystem.split(/\r?\n---USER---\r?\n/)
  if (user === undefined) {
    throw new Error("Prompt file missing ---USER--- marker")
  }

  const frontmatter: Record<string, string> = {}
  for (const line of header.split(/\r?\n/)) {
    const match = /^([a-z_]+):\s*(.+)$/.exec(line)
    if (match) frontmatter[match[1]] = match[2].trim()
  }

  return { frontmatter, system: system.trim(), user: user.trim() }
}
