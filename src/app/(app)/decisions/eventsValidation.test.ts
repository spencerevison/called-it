import { describe, expect, it } from "vitest"
import { parseReviseInput, parseReverseInput } from "./eventsValidation"

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

describe("parseReviseInput", () => {
  it("accepts a note", () => {
    const result = parseReviseInput(formData({ note: "swapped vendor B for vendor C" }))
    expect(result).toEqual({ ok: true, value: { note: "swapped vendor B for vendor C" } })
  })

  it("requires a note", () => {
    const result = parseReviseInput(formData({}))
    expect(result).toEqual({ ok: false, errors: { note: "Required." } })
  })

  it("rejects a whitespace-only note", () => {
    const result = parseReviseInput(formData({ note: "   " }))
    expect(result.ok).toBe(false)
  })
})

describe("parseReverseInput", () => {
  it("accepts a reason", () => {
    const result = parseReverseInput(formData({ reason: "market shifted" }))
    expect(result).toEqual({ ok: true, value: { reason: "market shifted" } })
  })

  it("requires a reason", () => {
    const result = parseReverseInput(formData({}))
    expect(result).toEqual({ ok: false, errors: { reason: "Required." } })
  })
})
