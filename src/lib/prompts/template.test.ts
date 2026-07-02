import { describe, expect, it } from "vitest"
import { renderTemplate } from "./template"

describe("renderTemplate", () => {
  it("substitutes scalar variables", () => {
    expect(renderTemplate("hello {{name}}", { name: "world" })).toBe("hello world")
  })

  it("leaves missing variables blank", () => {
    expect(renderTemplate("hello {{name}}", {})).toBe("hello ")
  })

  it("loops over array sections with per-item context", () => {
    const out = renderTemplate("{{#items}}- {{label}}\n{{/items}}", {
      items: [{ label: "a" }, { label: "b" }],
    })
    expect(out).toBe("- a\n- b\n")
  })

  it("renders an inline boolean section only when truthy", () => {
    const out = renderTemplate("{{#items}}{{label}}{{#flag}} (flag){{/flag}}\n{{/items}}", {
      items: [
        { label: "a", flag: true },
        { label: "b", flag: false },
      ],
    })
    expect(out).toBe("a (flag)\nb\n")
  })
})
