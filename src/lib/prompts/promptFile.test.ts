import { describe, expect, it } from "vitest"
import { parsePromptFile } from "./promptFile"

const FIXTURE = `# premortem_v1

kind: premortem
model: claude-sonnet-5
notes: some notes

---SYSTEM---

You are a system prompt about {{horizon_months}} months.

---USER---

DECISION: {{title}}
`

describe("parsePromptFile", () => {
  it("splits frontmatter, system, and user sections", () => {
    const parsed = parsePromptFile(FIXTURE)
    expect(parsed.frontmatter).toEqual({
      kind: "premortem",
      model: "claude-sonnet-5",
      notes: "some notes",
    })
    expect(parsed.system).toBe("You are a system prompt about {{horizon_months}} months.")
    expect(parsed.user).toBe("DECISION: {{title}}")
  })

  it("throws when markers are missing", () => {
    expect(() => parsePromptFile("no markers here")).toThrow(/---SYSTEM---/)
    expect(() => parsePromptFile("header\n---SYSTEM---\nbody, no user marker")).toThrow(
      /---USER---/,
    )
  })
})
