import { describe, expect, it } from "vitest"
import { parseCommitInput } from "./commitValidation"

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

describe("parseCommitInput", () => {
  it("accepts three dates", () => {
    const result = parseCommitInput(
      formData({ checkinTwoWeeks: "2026-07-16", checkinTwoMonths: "2026-09-02", checkinSixMonths: "2027-01-02" }),
    )
    expect(result).toEqual({
      ok: true,
      value: { checkinTwoWeeks: "2026-07-16", checkinTwoMonths: "2026-09-02", checkinSixMonths: "2027-01-02" },
    })
  })

  it("requires all three dates", () => {
    const result = parseCommitInput(formData({ checkinTwoWeeks: "2026-07-16" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.checkinTwoMonths).toBeTruthy()
      expect(result.errors.checkinSixMonths).toBeTruthy()
      expect(result.errors.checkinTwoWeeks).toBeUndefined()
    }
  })
})
