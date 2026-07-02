import { describe, expect, it } from "vitest"
import { safeNext } from "./route"

describe("safeNext (open-redirect guard)", () => {
  // the four bypass vectors -- all must collapse to "/"
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "https:evil.com"])(
    "rejects %s",
    (payload) => {
      expect(safeNext(payload)).toBe("/")
    },
  )

  it("keeps a same-origin path with query + hash", () => {
    expect(safeNext("/decisions/123?x=1#top")).toBe("/decisions/123?x=1#top")
  })

  it("defaults null/empty to /", () => {
    expect(safeNext(null)).toBe("/")
    expect(safeNext("")).toBe("/")
  })
})
