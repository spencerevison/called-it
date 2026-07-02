import { describe, expect, it } from "vitest"
import { parseDecisionInput } from "./validation"

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v)
    } else {
      fd.append(key, value)
    }
  }
  return fd
}

describe("parseDecisionInput", () => {
  it("accepts a fully filled draft", () => {
    const result = parseDecisionInput(
      formData({
        title: "Take the job",
        context: "Offer expires Friday.",
        rationale: "Better comp and growth.",
        option: ["Take it", "Stay", "Counter"],
        chosenOption: "Take it",
        stakes: "high",
        reversibility: "one_way",
      }),
    )
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Take the job",
        context: "Offer expires Friday.",
        rationale: "Better comp and growth.",
        options: ["Take it", "Stay", "Counter"],
        chosenOption: "Take it",
        stakes: "high",
        reversibility: "one_way",
      },
    })
  })

  it("trims whitespace and drops empty options", () => {
    const result = parseDecisionInput(
      formData({
        title: "  Move cities  ",
        context: " lease ends soon ",
        rationale: "",
        option: ["  Move  ", "", "  Stay  "],
        chosenOption: "Move",
        stakes: "medium",
        reversibility: "two_way",
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.title).toBe("Move cities")
      expect(result.value.context).toBe("lease ends soon")
      expect(result.value.rationale).toBeNull()
      expect(result.value.options).toEqual(["Move", "Stay"])
    }
  })

  it("requires a title", () => {
    const result = parseDecisionInput(
      formData({ title: "", context: "x", option: ["a"], chosenOption: "a" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.title).toBeDefined()
  })

  it("requires context", () => {
    const result = parseDecisionInput(
      formData({ title: "x", context: "", option: ["a"], chosenOption: "a" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.context).toBeDefined()
  })

  it("requires at least one option", () => {
    const result = parseDecisionInput(
      formData({ title: "x", context: "y", option: ["   "], chosenOption: "" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.options).toBeDefined()
  })

  it("requires chosenOption to be one of the options", () => {
    const result = parseDecisionInput(
      formData({ title: "x", context: "y", option: ["a", "b"], chosenOption: "c" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.chosenOption).toBeDefined()
  })

  it("defaults stakes and reversibility when missing or invalid", () => {
    const result = parseDecisionInput(
      formData({
        title: "x",
        context: "y",
        option: ["a"],
        chosenOption: "a",
        stakes: "bogus",
        reversibility: "bogus",
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.stakes).toBe("medium")
      expect(result.value.reversibility).toBe("two_way")
    }
  })
})
