import { describe, expect, it } from "vitest"
import { renderPremortemPromptFromRaw } from "./prompt"

const FIXTURE = `# premortem_v1

kind: premortem
model: claude-sonnet-5

---SYSTEM---

Assume it is {{horizon_months}} months later.

---USER---

Title: {{title}}
Options considered: {{options_considered}}
Chosen option: {{chosen_option}}
{{#forecasts}}
- "{{question}}" — p = {{probability}}{{#desired}} (desired outcome){{/desired}}
{{/forecasts}}
`

describe("renderPremortemPromptFromRaw", () => {
  it("renders decision fields and the fixed 6-month horizon", () => {
    const { system, user } = renderPremortemPromptFromRaw(FIXTURE, {
      decision: {
        title: "Take the new job",
        context: "irrelevant here",
        rationale: null,
        optionsConsidered: ["stay", "leave"],
        chosenOption: "leave",
        stakes: "high",
        reversibility: "one_way",
      },
      forecasts: [{ question: "Will I regret it?", probability: 0.2, desired: true }],
    })

    expect(system).toContain("6 months later")
    expect(user).toContain("Title: Take the new job")
    expect(user).toContain("Options considered: stay, leave")
    expect(user).toContain("Chosen option: leave")
    expect(user).toContain('"Will I regret it?" — p = 0.2 (desired outcome)')
  })
})
