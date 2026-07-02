import { describe, expect, it, vi } from "vitest"
import { generatePremortemRisks } from "./generate"

const DECISION_INPUT = {
  decision: {
    title: "Take the new job",
    context: "Offer from a startup vs staying put",
    rationale: "Growth potential outweighs the risk",
    optionsConsidered: ["stay", "leave"],
    chosenOption: "leave",
    stakes: "high" as const,
    reversibility: "one_way" as const,
  },
  forecasts: [{ question: "Will I regret it?", probability: 0.2, desired: true }],
}

function risk(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    description: "The startup runs out of runway within a year",
    category: "external",
    severity: "high",
    likelihood: 0.3,
    ...overrides,
  }
}

const VALID_OUTPUT = JSON.stringify({
  risks: Array.from({ length: 6 }, (_, i) => risk({ description: `risk ${i}` })),
})

describe("generatePremortemRisks", () => {
  it("parses a valid response on the first attempt", async () => {
    const callLlm = vi.fn().mockResolvedValue(VALID_OUTPUT)
    const risks = await generatePremortemRisks(DECISION_INPUT, callLlm)
    expect(risks).toHaveLength(6)
    expect(callLlm).toHaveBeenCalledTimes(1)
  })

  it("retries once on malformed JSON, then succeeds", async () => {
    const callLlm = vi
      .fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(VALID_OUTPUT)
    const risks = await generatePremortemRisks(DECISION_INPUT, callLlm)
    expect(risks).toHaveLength(6)
    expect(callLlm).toHaveBeenCalledTimes(2)
  })

  it("retries once on schema-invalid JSON, then throws if still invalid", async () => {
    const tooFew = JSON.stringify({ risks: [risk()] })
    const callLlm = vi.fn().mockResolvedValue(tooFew)
    await expect(generatePremortemRisks(DECISION_INPUT, callLlm)).rejects.toThrow()
    expect(callLlm).toHaveBeenCalledTimes(2)
  })

  it("throws after a second malformed-JSON attempt", async () => {
    const callLlm = vi.fn().mockResolvedValue("still not json")
    await expect(generatePremortemRisks(DECISION_INPUT, callLlm)).rejects.toThrow()
    expect(callLlm).toHaveBeenCalledTimes(2)
  })
})
