import { describe, expect, it } from "vitest"
import { parseRiskInput } from "./riskValidation"

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

describe("parseRiskInput", () => {
  it("accepts a fully filled risk", () => {
    const result = parseRiskInput(
      formData({ description: "I underestimate the timeline", category: "execution", severity: "high" }),
    )
    expect(result).toEqual({
      ok: true,
      value: { description: "I underestimate the timeline", category: "execution", severity: "high" },
    })
  })

  it("requires a description", () => {
    const result = parseRiskInput(formData({ category: "execution", severity: "high" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.description).toBeDefined()
  })

  it("rejects an unknown category", () => {
    const result = parseRiskInput(
      formData({ description: "x", category: "not_a_category", severity: "high" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.category).toBeDefined()
  })

  it("rejects an unknown severity", () => {
    const result = parseRiskInput(
      formData({ description: "x", category: "execution", severity: "critical" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.severity).toBeDefined()
  })
})
