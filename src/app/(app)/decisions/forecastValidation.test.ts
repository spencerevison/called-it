import { describe, expect, it } from "vitest"
import { parseForecastInput } from "./forecastValidation"

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

describe("parseForecastInput", () => {
  it("accepts a fully filled forecast", () => {
    const result = parseForecastInput(
      formData({
        question: "Will the launch ship by Friday?",
        probability: "0.7",
        desired: "on",
        resolveBy: "2026-08-01",
      }),
    )
    expect(result).toEqual({
      ok: true,
      value: {
        question: "Will the launch ship by Friday?",
        probability: 0.7,
        desired: true,
        resolveBy: "2026-08-01",
      },
    })
  })

  it("treats a missing desired field as false (unchecked checkbox)", () => {
    const result = parseForecastInput(
      formData({ question: "x", probability: "0.5" }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.desired).toBe(false)
  })

  it("requires a question", () => {
    const result = parseForecastInput(formData({ probability: "0.5" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.question).toBeDefined()
  })

  it("requires probability to be present", () => {
    const result = parseForecastInput(formData({ question: "x", probability: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.probability).toBeDefined()
  })

  it("rejects probability below 0.01", () => {
    const result = parseForecastInput(formData({ question: "x", probability: "0.005" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.probability).toBeDefined()
  })

  it("rejects probability above 0.99", () => {
    const result = parseForecastInput(formData({ question: "x", probability: "1" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.probability).toBeDefined()
  })

  it("treats empty resolveBy as null", () => {
    const result = parseForecastInput(
      formData({ question: "x", probability: "0.5", resolveBy: "" }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.resolveBy).toBeNull()
  })
})
